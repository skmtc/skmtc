import { join } from '@std/path/join'
import { parse } from '@std/path/parse'
import { resolve } from '@std/path/resolve'
import { ensureDirSync } from '@std/fs/ensure-dir'
import { ensureFileSync } from '@std/fs/ensure-file'
import { existsSync } from '@std/fs/exists'
import { type ManifestContent, manifestContent } from '@skmtc/core/Manifest'
import type { ClientSettings } from '@skmtc/core/Settings'
import { applyGeneratedSuffix, DEFAULT_GENERATED_SUFFIX, toResolvedArtifactPath } from '@skmtc/core'
import * as v from 'valibot'
import { toAbsoluteRootPath, toRootPath } from '@/lib/to-root-path.ts'
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
import { formatContent, runFormatter } from '@/lib/formatter.ts'
import { classifyDiskFile, type EditDetectionContext } from '@/lib/edit-detection.ts'
import { readEjections, toEjectionsPath } from '@/lib/ejections.ts'
import {
  type EjectionFileState,
  toEjectionStatePath,
  writeEjectionState
} from '@/lib/ejection-state.ts'
import { classifyThreeWay, isThreeWayDiffable } from '@/lib/three-way.ts'
import { toCommittedBaselinePath, toPristinePath } from '@/lib/baseline-store.ts'
import { dirname } from '@std/path/dirname'

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
      toResolvedArtifactPath({
        basePath: clientSettings?.basePath,
        destinationPath
      })
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
const readManifestForCleanup = (raw: string, manifestPath: string): ManifestContent | null => {
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
  /**
   * Drift report for ejected files, present when the project has any.
   * All lists carry owned artifact paths. `drifted` contains only
   * UNREVIEWED drift (nag control: an acknowledged drift —
   * `reviewedPristineHash` in ejections.json matching the current
   * pristine hash — stays out until the output changes again).
   */
  /**
   * On-disk content per artifact whose file no longer matches the raw
   * engine render at the end of the run — formatted by
   * `settings.formatter` this run, or left formatted by a previous run
   * when this run's render was unchanged. The sidecar/manifest
   * realignment in `generate-local.ts` consumes this so attribution
   * describes the file as it actually exists on disk.
   */
  onDiskDrift: Record<string, string>
  ejections?: {
    drifted: string[]
    reAdoptable: string[]
    stale: string[]
    /** Suffixed twins of ejected files that a (version-skewed) engine emitted — blocked from writing. */
    twinBlocked: string[]
  }
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

  // Suffixed twins of ejected files. A correctly-versioned engine maps
  // an ejected item to its owned path, so its suffixed form should
  // never appear in the artifacts — when it does (a stale bundle
  // pinning a pre-ejection core), writing it would plant a duplicate
  // next to the user's file. Blocked, loudly.
  const generatedSuffix = clientSettings?.generatedSuffix ?? DEFAULT_GENERATED_SUFFIX
  const twinArtifactPaths = new Set<string>()
  for (const ejectedPath of clientSettings?.ejected ?? []) {
    const ownedArtifact = toResolvedArtifactPath({
      basePath: clientSettings?.basePath,
      destinationPath: ejectedPath
    })
    const twinArtifact = toResolvedArtifactPath({
      basePath: clientSettings?.basePath,
      destinationPath: applyGeneratedSuffix(ejectedPath, generatedSuffix)
    })
    if (twinArtifact !== ownedArtifact) {
      twinArtifactPaths.add(twinArtifact)
    }
  }
  const twinBlocked: string[] = []

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

    if (twinArtifactPaths.has(artifactPath)) {
      twinBlocked.push(artifactPath)
      continue
    }

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
      pendingWrites.push({
        artifactPath,
        absolutePath,
        canonicalHash,
        content
      })
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
        nextLockFiles[artifactPath] = {
          canonicalHash,
          formattedHash: canonicalHash
        }
        if (baselinesDir) {
          writeBaseline(baselinesDir, artifactPath, content)
        }
        continue
      }

      Deno.writeTextFileSync(absolutePath, content)
      pendingWrites.push({
        artifactPath,
        absolutePath,
        canonicalHash,
        content
      })
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

  // Ejected files keep their lock entry even when no generator produced
  // them this run (a stale ejection): the in-loop carry-forward only
  // sees incoming artifact paths. Without this, a stale run drops the
  // entry, a later adopt has nothing to re-key, and the post-adopt
  // generate treats the user's file as untracked — overwriting it.
  for (const path of ejectedArtifactPaths) {
    const previousEntry = lock?.files[path]
    if (previousEntry && !nextLockFiles[path]) {
      nextLockFiles[path] = previousEntry
    }
  }

  writeGeneratedLock(lockPath, { version: 1, files: nextLockFiles })

  const ejections = toEjectionReport({
    artifacts: artifacts ?? {},
    clientSettings,
    manifestPath,
    projectPath,
    skmtcRootPath,
    appRoot,
    twinBlocked
  })

  if (ejections) {
    if (ejections.twinBlocked.length > 0) {
      console.error(
        `Warning: refused to write ${ejections.twinBlocked.length} generated twin(s) of ` +
          `ejected file(s):\n${ejections.twinBlocked.map(path => `  ${path}`).join('\n')}\n` +
          `The engine that produced this run does not honor settings.ejected — rebundle the ` +
          `project so its core pin supports ejection.`
      )
    }
    if (ejections.drifted.length > 0) {
      console.error(
        `Note: ${ejections.drifted.length} ejected file(s) have drifted behind their ` +
          `generators:\n${ejections.drifted.map(path => `  ${path}`).join('\n')}\n` +
          `See \`skmtc status\` for details.`
      )
    }
    if (ejections.reAdoptable.length > 0) {
      console.error(
        `Note: ${ejections.reAdoptable.length} ejected file(s) now match generated output — ` +
          `return them to generation with \`skmtc adopt\`:\n` +
          ejections.reAdoptable.map(path => `  ${path}`).join('\n')
      )
    }
    if (ejections.stale.length > 0) {
      console.error(
        `Note: ${ejections.stale.length} ejected file(s) are no longer produced by any ` +
          `generator:\n${ejections.stale.map(path => `  ${path}`).join('\n')}\n` +
          `The schema item was removed or renamed; the file stays yours.`
      )
    }
  }

  if (warnOnProtected && protectedPaths.length > 0) {
    console.error(
      `Warning: ${protectedPaths.length} generated file(s) have manual edits and were left ` +
        `untouched:\n${protectedPaths.map(path => `  ${path}`).join('\n')}\n` +
        `Generated files are overwritten on each run — move lasting changes into enrichments ` +
        `or hand-written modules, or revert the files to resume generation for them.`
    )
  }

  // On-disk drift vs the raw render, for the sidecar/manifest realignment
  // in generate-local. Only FORMATTER-attributable drift qualifies:
  // - collected only when `settings.formatter` is configured (no formatter
  //   → nothing legitimate can have drifted, and skipping the scan avoids
  //   re-reading the whole corpus per generate);
  // - hand-edited files (`protectedPaths` — both the stale-spared and the
  //   incoming-write-skipped kinds) are excluded: realigning attribution
  //   onto user-owned text and silencing the reader's drift trigger for it
  //   would serve confidently wrong spans.
  // Read AFTER the formatter step so a just-formatted file is captured;
  // covers unwritten (unchanged-render) files too — their on-disk copy
  // stays formatted from a previous run.
  const onDiskDrift: Record<string, string> = {}
  if (formatterCommand) {
    const protectedSet = new Set(protectedPaths)
    for (const [artifactPath, artifactContent] of Object.entries(artifacts ?? {})) {
      if (
        twinArtifactPaths.has(artifactPath) ||
        ejectedArtifactPaths.has(artifactPath) ||
        protectedSet.has(artifactPath)
      ) {
        continue
      }
      try {
        const onDisk = Deno.readTextFileSync(join(skmtcRootPath, '..', artifactPath))
        if (onDisk !== String(artifactContent)) {
          onDiskDrift[artifactPath] = onDisk
        }
      } catch {
        // unreadable → nothing to realign against; raw coordinates stand
      }
    }
  }

  return {
    manifest,
    artifacts,
    protectedPaths,
    onDiskDrift,
    ...(ejections ? { ejections } : {})
  }
}

/**
 * Computes the per-run drift state of every ejected file. This is the
 * only moment all three versions exist together: B (the committed
 * baseline from eject time), P (this run's pristine render, present in
 * `artifacts` because ejected items still generate in memory), and D
 * (the user's file on disk).
 *
 * State precedence: `re-adoptable` wins over `quiet` — a file that
 * matches current generated output should return to generation even
 * when the generator hasn't moved (the user reverted their edit).
 * Drift is formatter-free (canonical P vs canonical B); only the
 * re-adopt check compares through the formatter, because D is a
 * formatted file.
 */
const toEjectionReport = ({
  artifacts,
  clientSettings,
  manifestPath,
  projectPath,
  skmtcRootPath,
  appRoot,
  twinBlocked
}: {
  artifacts: Record<string, string>
  clientSettings: ClientSettings | undefined
  manifestPath: string
  projectPath: string | undefined
  skmtcRootPath: string
  appRoot: string
  twinBlocked: string[]
}): WriteGeneratedFilesResult['ejections'] => {
  const ejectedExportPaths = clientSettings?.ejected ?? []

  if (ejectedExportPaths.length === 0 && twinBlocked.length === 0) {
    return undefined
  }

  const records = readEjections(toEjectionsPath(manifestPath))
  const formatterCommand = clientSettings?.formatter

  const drifted: string[] = []
  const reAdoptable: string[] = []
  const stale: string[] = []
  const stateFiles: Record<string, EjectionFileState> = {}

  for (const ejectedExportPath of ejectedExportPaths) {
    const ownedArtifactPath = toResolvedArtifactPath({
      basePath: clientSettings?.basePath,
      destinationPath: ejectedExportPath
    })
    const absoluteOwned = join(skmtcRootPath, '..', ownedArtifactPath)

    const pristine = artifacts[ownedArtifactPath]

    if (pristine === undefined) {
      stale.push(ownedArtifactPath)
      stateFiles[ownedArtifactPath] = { state: 'stale' }
      if (projectPath) {
        try {
          Deno.removeSync(toPristinePath(projectPath, ownedArtifactPath))
        } catch (_error) {
          // Absent — nothing to clear.
        }
      }
      continue
    }

    // Persist this run's pristine render — the "theirs" side a later
    // `skmtc merge` needs, since merge runs without the engine.
    if (projectPath) {
      const pristinePath = toPristinePath(projectPath, ownedArtifactPath)
      ensureDirSync(dirname(pristinePath))
      Deno.writeTextFileSync(pristinePath, pristine)
    }

    const pristineHash = toContentHash(pristine)
    const record = records.files[ejectedExportPath]

    const diskContent = existsSync(absoluteOwned) ? Deno.readTextFileSync(absoluteOwned) : undefined

    const matchesGenerated =
      diskContent !== undefined &&
      (formatterCommand
        ? formatContent({
            command: formatterCommand,
            absolutePath: absoluteOwned,
            content: pristine,
            cwd: appRoot
          }) === diskContent
        : pristine === diskContent)

    if (matchesGenerated) {
      reAdoptable.push(ownedArtifactPath)
      stateFiles[ownedArtifactPath] = { state: 're-adoptable', pristineHash }
      continue
    }

    // Without a recorded baseline hash (a hand-added settings.ejected
    // entry) there is no drift signal — the file is quietly owned.
    if (!record?.baselineHash || pristineHash === record.baselineHash) {
      stateFiles[ownedArtifactPath] = { state: 'quiet', pristineHash }
      continue
    }

    const reviewed = record.reviewedPristineHash === pristineHash

    const baselineContent =
      projectPath && existsSync(toCommittedBaselinePath(projectPath, ownedArtifactPath))
        ? Deno.readTextFileSync(toCommittedBaselinePath(projectPath, ownedArtifactPath))
        : undefined

    // Skip classification (leaving "overlap unknown") when any side is
    // too large for the line diff — the O(n·m) LCS would stall the
    // generate. See MAX_DIFF_CELLS.
    const classification =
      baselineContent !== undefined &&
      diskContent !== undefined &&
      isThreeWayDiffable({
        base: baselineContent,
        ours: diskContent,
        theirs: pristine
      })
        ? classifyThreeWay({
            base: baselineContent,
            ours: diskContent,
            theirs: pristine
          })
        : undefined

    stateFiles[ownedArtifactPath] = {
      state: 'drifted',
      pristineHash,
      ...(classification ? { classification } : {}),
      reviewed
    }

    if (!reviewed) {
      drifted.push(ownedArtifactPath)
    }
  }

  if (projectPath) {
    writeEjectionState(toEjectionStatePath(projectPath), {
      version: 1,
      files: stateFiles
    })
  }

  return { drifted, reAdoptable, stale, twinBlocked }
}
