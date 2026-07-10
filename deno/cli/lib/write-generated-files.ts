import { join } from '@std/path/join'
import { parse } from '@std/path/parse'
import { resolve } from '@std/path/resolve'
import { ensureDirSync } from '@std/fs/ensure-dir'
import { ensureFileSync } from '@std/fs/ensure-file'
import { existsSync } from '@std/fs/exists'
import { type ManifestContent, manifestContent } from '@skmtc/core/Manifest'
import type { ClientSettings } from '@skmtc/core/Settings'
import { toResolvedArtifactPath } from '@skmtc/core'
import * as v from 'valibot'
import { toRootPath, toAbsoluteRootPath } from '@/lib/to-root-path.ts'
import { pruneEmptyDirs, toAnchorDirs } from '@/lib/prune-empty-dirs.ts'
import {
  type GeneratedLockEntry,
  readGeneratedLock,
  toContentHash,
  toGeneratedLockPath,
  writeGeneratedLock
} from '@/lib/generated-lock.ts'
import {
  readBaseline,
  removeBaseline,
  toBaselinePath,
  toBaselinesDir,
  writeBaseline
} from '@/lib/baseline-store.ts'
import { runFormatter } from '@/lib/formatter.ts'
import { classifyDiskFile, type EditDetectionContext } from '@/lib/edit-detection.ts'

/**
 * Artifact-space keys of the project's ejected files: each
 * `settings.ejected` entry (a suffix-less export path like
 * `@/types/user.tsx`) resolved the same way the engine resolves
 * artifact keys, so membership can be tested directly against the
 * incoming `artifacts` map and manifest keys.
 */
export const toEjectedArtifactPaths = (clientSettings?: ClientSettings): Set<string> => {
  return new Set(
    (clientSettings?.ejected ?? []).map(destinationPath =>
      toResolvedArtifactPath({ basePath: clientSettings?.basePath, destinationPath })
    )
  )
}

type DeletePreviousArtifactsArgs = {
  skmtcRootPath: string
  manifestPath: string
  incomingPaths: string[]
  /** Output anchors from the run's client.json — used to bound the
   *  empty-dir prune that follows file deletion. When absent (no
   *  basePath, or called without settings), dirs aren't pruned. */
  clientSettings?: ClientSettings
  /**
   * Edit-detection context. When absent (legacy callers), pruning
   * behaves as before: every stale manifest path is deleted. When
   * present, a stale file classified as hand-edited is left in place
   * and reported through `onProtected`.
   */
  detection?: EditDetectionContext
  /** Receives the artifact path of every stale-but-edited file spared from deletion. */
  onProtected?: (artifactPath: string) => void
  /**
   * Artifact-space paths of ejected (user-owned) files — never
   * deleted, regardless of manifest state. Defaults to the set derived
   * from `clientSettings.ejected`.
   */
  ejectedArtifactPaths?: Set<string>
}

export const deletePreviousArtifacts = ({
  skmtcRootPath,
  incomingPaths,
  manifestPath,
  clientSettings,
  detection,
  onProtected,
  ejectedArtifactPaths = toEjectedArtifactPaths(clientSettings)
}: DeletePreviousArtifactsArgs): void => {
  if (!existsSync(manifestPath)) {
    return
  }

  // Tolerant read: stale/malformed manifests degrade to a no-op
  // instead of aborting the generate run. The next `skmtc generate`
  // pass rewrites the manifest, so a stale one is self-healing —
  // it just means we can't prune the previous run's artifacts on
  // this single pass. The warning lands on stderr so `--json`
  // consumers reading stdout stay clean.
  const raw = Deno.readTextFileSync(manifestPath)
  const manifestFile = readManifestForCleanup(raw, manifestPath)
  if (manifestFile === null) {
    return
  }

  const paths = Object.keys(manifestFile.files)

  const deletedAbsPaths: string[] = []

  for (const path of paths) {
    try {
      if (incomingPaths.includes(path)) {
        continue
      }

      // Ejected files are the user's — never deleted, even when no
      // generator produces them anymore.
      if (ejectedArtifactPaths.has(path)) {
        continue
      }

      const absolutePath = join(skmtcRootPath, '..', path)

      // A stale artifact the user has edited is theirs now — deleting
      // it would destroy their work. Leave it and let the caller report.
      const lockEntry = detection?.lock?.files[path]
      if (detection && lockEntry && existsSync(absolutePath)) {
        const { edited } = classifyDiskFile({
          artifactPath: path,
          absolutePath,
          lockEntry,
          detection
        })

        if (edited) {
          onProtected?.(path)
          continue
        }
      }

      Deno.removeSync(absolutePath)
      deletedAbsPaths.push(absolutePath)

      if (detection?.baselinesDir) {
        removeBaseline(detection.baselinesDir, path)
      }
    } catch (_error) {
      // Ignore
      // console.error(`Failed to delete artifact: "${error}"`)
    }
  }

  // Prune any directories the stale-artifact deletion emptied, bounded
  // by the output anchors so the walk can never remove basePath or a
  // package root. Same self-limiting prune `clean` uses.
  const anchors = toAnchorDirs(resolve(toAbsoluteRootPath()), clientSettings)
  if (anchors && deletedAbsPaths.length > 0) {
    pruneEmptyDirs({ deletedAbsPaths, anchors, dryRun: false })
  }
}

/**
 * Parses a manifest payload, returning `null` for any failure that
 * would otherwise abort cleanup. Mirrors the tolerant behavior of
 * `Manifest.open` — see {@link lib/manifest.ts}.
 */
const readManifestForCleanup = (
  raw: string,
  manifestPath: string
): ManifestContent | null => {
  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(raw)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(
      `Warning: manifest at ${manifestPath} contains invalid JSON (${message}); ` +
        `skipping previous-artifact cleanup. The next \`skmtc generate\` run will rewrite it.`
    )
    return null
  }
  const result = v.safeParse(manifestContent, parsedJson)
  if (!result.success) {
    const summary = result.issues[0]?.message ?? 'schema mismatch'
    console.error(
      `Warning: manifest at ${manifestPath} doesn't match the current schema (${summary}); ` +
        `skipping previous-artifact cleanup. The next \`skmtc generate\` run will rewrite it.`
    )
    return null
  }
  return result.output
}

type WriteGeneratedFilesArgs = {
  manifestPath: string
  artifacts: Record<string, string>
  manifest: ManifestContent
  /** Output anchors from the run's client.json — forwarded to the
   *  stale-artifact prune so it can clean up emptied directories.
   *  Also supplies the `formatter` command for post-write formatting
   *  and formatter-aware edit detection. */
  clientSettings?: ClientSettings
  /**
   * Filesystem path of the project — `.skmtc/<project>/`. Enables the
   * canonical-content baseline store (`<projectPath>/.baselines/`),
   * which is what lets edit detection tell a formatter-config change
   * apart from a hand edit. Omitted → baselines are disabled and only
   * lock-hash comparison runs.
   */
  projectPath?: string
  /**
   * Suppress the multi-line stderr warning for protected files. Watch
   * mode sets this — re-announcing the same protected files on every
   * rebuild is alarm fatigue; `dev` prints its own one-line status
   * instead. Protection itself is unaffected.
   */
  warnOnProtected?: boolean
}

export type WriteGeneratedFilesResult = {
  manifest: ManifestContent
  artifacts: Record<string, string>
  /**
   * Artifact paths that were NOT written (or deleted) this run because
   * the on-disk file no longer matches what the previous run produced —
   * i.e. the user hand-edited it. The prime invariant: `generate`
   * never destroys a hand edit.
   */
  protectedPaths: string[]
}

export const writeGeneratedFiles = ({
  manifestPath,
  artifacts,
  manifest,
  clientSettings,
  projectPath,
  warnOnProtected = true
}: WriteGeneratedFilesArgs): WriteGeneratedFilesResult => {
  const skmtcRootPath = toRootPath()
  const appRoot = resolve(skmtcRootPath, '..')

  const lockPath = toGeneratedLockPath(manifestPath)
  const lock = readGeneratedLock(lockPath)
  const baselinesDir = projectPath ? toBaselinesDir(projectPath) : null

  const detection: EditDetectionContext = {
    lock,
    formatterCommand: clientSettings?.formatter,
    baselinesDir,
    appRoot
  }

  const protectedPaths: string[] = []
  const ejectedArtifactPaths = toEjectedArtifactPaths(clientSettings)

  deletePreviousArtifacts({
    incomingPaths: Object.keys(artifacts ?? {}),
    manifestPath,
    skmtcRootPath,
    clientSettings,
    detection,
    onProtected: path => protectedPaths.push(path)
  })

  // Mark ejected entries before the manifest lands on disk, so every
  // manifest consumer (clean, status, agents reading --json) can tell
  // user-owned files apart without re-deriving the ejected set.
  for (const path of Object.keys(manifest.files)) {
    if (ejectedArtifactPaths.has(path)) {
      manifest.files[path].ejected = true
    }
  }

  ensureFileSync(manifestPath)

  Deno.writeTextFileSync(manifestPath, JSON.stringify(manifest, null, 2))

  const nextLockFiles: Record<string, GeneratedLockEntry> = {}
  const pendingWrites: Array<{
    artifactPath: string
    absolutePath: string
    canonicalHash: string
    content: string
  }> = []

  for (const [artifactPath, artifactContent] of Object.entries(artifacts ?? {})) {
    const content = String(artifactContent)
    const absolutePath = join(skmtcRootPath, '..', artifactPath)
    const canonicalHash = toContentHash(content)

    if (ejectedArtifactPaths.has(artifactPath)) {
      // Ejected: the user owns this file. The engine still rendered it
      // (that content is drift detection's input) but the host never
      // writes it. The lock entry carries forward untouched — it is
      // the base a future adopt/merge resolves from.
      const previousEntry = lock?.files[artifactPath]
      if (previousEntry) {
        nextLockFiles[artifactPath] = previousEntry
      }
      continue
    }

    if (!existsSync(absolutePath)) {
      const { dir } = parse(absolutePath)
      ensureDirSync(dir)
      Deno.writeTextFileSync(absolutePath, content)
      pendingWrites.push({ artifactPath, absolutePath, canonicalHash, content })
      continue
    }

    const lockEntry = lock?.files[artifactPath]

    if (!lockEntry) {
      // Untracked file (first run with edit detection, or a fresh
      // clone without the lock): preserve the pre-lock behavior —
      // changed-only overwrite — and seed a lock entry so the NEXT
      // run can tell edits apart. Render output is deterministic, so
      // skipping byte-identical rewrites also keeps mtimes stable for
      // file-watch consumers (Vite HMR, `skmtc dev`).
      const diskContent = Deno.readTextFileSync(absolutePath)

      if (diskContent === content) {
        nextLockFiles[artifactPath] = { canonicalHash, formattedHash: canonicalHash }
        if (baselinesDir) {
          writeBaseline(baselinesDir, artifactPath, content)
        }
        continue
      }

      Deno.writeTextFileSync(absolutePath, content)
      pendingWrites.push({ artifactPath, absolutePath, canonicalHash, content })
      continue
    }

    const { edited, driftResolvedFormattedHash } = classifyDiskFile({
      artifactPath,
      absolutePath,
      lockEntry,
      detection
    })

    if (edited) {
      // The prime invariant: never destroy a hand edit. Keep the old
      // lock entry and baseline — they are what the user's edit was
      // made against, and what a future eject/merge resolves from.
      protectedPaths.push(artifactPath)
      nextLockFiles[artifactPath] = lockEntry
      continue
    }

    if (canonicalHash === lockEntry.canonicalHash) {
      // Unchanged render output on a clean file → no write (keeps
      // mtimes stable). Record the drift-resolved formatted hash when
      // a formatter-config change was detected so subsequent runs
      // compare cheaply again.
      nextLockFiles[artifactPath] = {
        canonicalHash: lockEntry.canonicalHash,
        formattedHash: driftResolvedFormattedHash ?? lockEntry.formattedHash
      }
      if (baselinesDir && toBaselinePath(baselinesDir, artifactPath) !== null) {
        const existingBaseline = readBaseline(baselinesDir, artifactPath)
        if (existingBaseline === null) {
          writeBaseline(baselinesDir, artifactPath, content)
        }
      }
      continue
    }

    // Changed render output on a clean file → overwrite.
    Deno.writeTextFileSync(absolutePath, content)
    pendingWrites.push({ artifactPath, absolutePath, canonicalHash, content })
  }

  // Post-write formatting: run the consumer's formatter over exactly
  // the files this run wrote, then record the formatted content's hash
  // so edit detection compares against what is actually on disk.
  const formatterCommand = clientSettings?.formatter

  if (formatterCommand && pendingWrites.length > 0) {
    const result = runFormatter({
      command: formatterCommand,
      filePaths: pendingWrites.map(({ absolutePath }) => absolutePath),
      cwd: appRoot
    })

    if (!result.ok) {
      console.error(
        `Warning: formatter command failed (${result.error}); ` +
          `generated files were written unformatted.`
      )
    }
  }

  for (const { artifactPath, absolutePath, canonicalHash, content } of pendingWrites) {
    const onDisk = Deno.readTextFileSync(absolutePath)
    nextLockFiles[artifactPath] = {
      canonicalHash,
      formattedHash: toContentHash(onDisk)
    }
    if (baselinesDir) {
      writeBaseline(baselinesDir, artifactPath, content)
    }
  }

  // Stale-but-edited files spared by the prune keep their lock entry so
  // future runs can still classify them.
  for (const path of protectedPaths) {
    const previousEntry = lock?.files[path]
    if (previousEntry && !nextLockFiles[path]) {
      nextLockFiles[path] = previousEntry
    }
  }

  writeGeneratedLock(lockPath, { version: 1, files: nextLockFiles })

  if (warnOnProtected && protectedPaths.length > 0) {
    console.error(
      `Warning: ${protectedPaths.length} generated file(s) have manual edits and were left ` +
        `untouched:\n${protectedPaths.map(path => `  ${path}`).join('\n')}\n` +
        `Generated files are overwritten on each run — move lasting changes into enrichments ` +
        `or hand-written modules, or revert the files to resume generation for them.`
    )
  }

  return { manifest, artifacts, protectedPaths }
}
