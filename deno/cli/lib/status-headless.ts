/**
 * Headless `status` path — classifies every generated file a project's
 * manifest records against the generated lock, answering "what does
 * the tool think is going on?":
 *
 *   - `clean`      — disk matches what the last generate run wrote
 *                    (directly, or via formatter-drift resolution)
 *   - `modified`   — disk was hand-edited since the last run; the next
 *                    generate will protect this file, not overwrite it
 *   - `missing`    — the manifest records it but it's gone from disk;
 *                    the next generate rewrites it
 *   - `unverified` — no lock entry (pre-lock project or fresh clone
 *                    without the lock); edit detection can't classify
 *                    it until a generate run seeds the lock
 *   - `ejected`    — user-owned by declaration
 *                    (`client.json#settings.ejected`); expected to
 *                    differ from generated output, never overwritten
 *                    or deleted
 *
 * `orphaned` lists lock entries for files the manifest no longer
 * tracks — stale-but-edited files a previous generate spared from
 * pruning. They are the user's now; listed so they aren't forgotten.
 *
 * Never writes. Resolves the schema and renders fresh content on
 * demand (the same schema-resolution + worker invocation `generate`
 * uses) to disambiguate a formatter-config change from a hand edit,
 * and to classify ejected files (`re-adoptable` / `owned` / `stale`)
 * against what the generator would produce right now. Degrades to
 * lock-hash-only comparison — and ejected files reporting without a
 * sub-state — when the schema can't be reached: safe to run any time,
 * including CI (`--check` turns a dirty status into a non-zero exit),
 * offline, or before a project has ever been generated.
 */

import { join } from '@std/path/join'
import { resolve } from '@std/path/resolve'
import { existsSync } from '@std/fs/exists'
import type { ClientSettings } from '@skmtc/core/Settings'
import { toResolvedArtifactPath } from '@skmtc/core'
import { Manifest } from '@/lib/manifest.ts'
import { toRootPath } from '@/lib/to-root-path.ts'
import { readGeneratedLock, toGeneratedLockPath } from '@/lib/generated-lock.ts'
import { classifyDiskFile, type EditDetectionContext } from '@/lib/edit-detection.ts'
import { toEjectedArtifactPaths } from '@/lib/write-generated-files.ts'
import { type EjectionFileState, classifyEjectedFile } from '@/lib/ejection-state.ts'
import { resolveFreshArtifacts } from '@/lib/resolve-fresh-artifacts.ts'

export type FileStatus = 'clean' | 'modified' | 'missing' | 'unverified' | 'ejected'

export type StatusFileEntry = {
  path: string
  status: FileStatus
  /**
   * For `ejected` files: the live state against this run's fresh
   * render. Absent when the schema couldn't be reached — the file is
   * still known to be `ejected`, just without a sub-state.
   */
  ejection?: EjectionFileState
}

export type StatusHeadlessResult = {
  projectName: string
  /** True when the project has no manifest — nothing to report. */
  noManifest: boolean
  files: StatusFileEntry[]
  /**
   * Lock-tracked paths absent from the manifest: stale-but-edited
   * files a previous generate spared from pruning.
   */
  orphaned: string[]
  /**
   * Ejected files no longer produced by any generator this run — the
   * schema item was removed or renamed. The files stay the user's;
   * listed so they aren't forgotten. Empty when the schema couldn't be
   * reached (can't be determined without a fresh render).
   */
  staleEjections: string[]
  counts: Record<FileStatus, number>
  /** True when nothing needs attention (no modified, no orphaned). */
  clean: boolean
}

type StatusHeadlessArgs = {
  projectName: string
  clientSettings: ClientSettings | undefined
  /** `client.json#source` — resolved fresh each run to disambiguate a
   *  formatter-config change from a hand edit, and to classify ejected
   *  files against current generated output. Absent, or unreachable,
   *  degrades gracefully (see module doc comment). */
  schemaSourceString: string | undefined
  /** `client.json#serverUrl` — generate against a deployed stack
   *  server instead of the local bundle, when set. */
  stackUrl: string | undefined
  /** Workspace root (`.skmtc`). Defaults to the cwd-derived
   *  `toRootPath()`. Injectable so tests can point at a temp workspace
   *  without depending on `Deno.cwd()`. */
  skmtcRootPath?: string
}

export const statusHeadless = async ({
  projectName,
  clientSettings,
  schemaSourceString,
  stackUrl,
  skmtcRootPath = toRootPath()
}: StatusHeadlessArgs): Promise<StatusHeadlessResult> => {
  const appRoot = resolve(join(skmtcRootPath, '..'))
  const projectPath = join(skmtcRootPath, projectName)
  const manifestPath = join(projectPath, '.settings', 'manifest.json')

  const manifest = await Manifest.openFromPath(projectName, manifestPath)

  const emptyCounts: Record<FileStatus, number> = {
    clean: 0,
    modified: 0,
    missing: 0,
    unverified: 0,
    ejected: 0
  }

  if (manifest.contents === null) {
    return {
      projectName,
      noManifest: true,
      files: [],
      orphaned: [],
      staleEjections: [],
      counts: emptyCounts,
      clean: true
    }
  }

  const lock = readGeneratedLock(toGeneratedLockPath(manifestPath))

  const detection: EditDetectionContext = {
    lock,
    formatterCommand: clientSettings?.formatter,
    appRoot
  }

  const freshArtifacts = await resolveFreshArtifacts({
    projectPath,
    schemaSourceString,
    clientSettings,
    stackUrl
  })

  const files: StatusFileEntry[] = []
  const counts = { ...emptyCounts }
  const ejectedArtifactPaths = toEjectedArtifactPaths(clientSettings)
  const formatterCommand = clientSettings?.formatter

  const manifestPaths = Object.keys(manifest.contents.files)
  const manifestPathSet = new Set(manifestPaths)

  for (const path of manifestPaths) {
    const absolutePath = join(skmtcRootPath, '..', path)

    // Ejected files are user-owned by declaration — expected to differ
    // from generated output, so they get their own status instead of
    // reading as `modified`.
    const isEjected: boolean =
      manifest.contents.files[path].ejected === true || ejectedArtifactPaths.has(path)

    const status = isEjected ? 'ejected' : toFileStatus({ path, absolutePath, detection, freshArtifacts })

    const ejection =
      isEjected && freshArtifacts
        ? classifyEjectedFile({
            pristine: freshArtifacts[path],
            diskContent: existsSync(absolutePath) ? Deno.readTextFileSync(absolutePath) : undefined,
            formatterCommand,
            absolutePath,
            appRoot
          })
        : undefined

    files.push({ path, status, ...(ejection ? { ejection } : {}) })
    counts[status] += 1
  }

  // Ejected files no longer produced by any generator don't appear in
  // the manifest (nothing produces them) — surface them separately.
  // Only determinable when the schema was reachable this run.
  const staleEjections: string[] = []
  if (freshArtifacts) {
    for (const ejectedExportPath of clientSettings?.ejected ?? []) {
      const ownedArtifactPath = toResolvedArtifactPath({
        basePath: clientSettings?.basePath,
        destinationPath: ejectedExportPath
      })
      if (!manifestPathSet.has(ownedArtifactPath) && freshArtifacts[ownedArtifactPath] === undefined) {
        staleEjections.push(ownedArtifactPath)
      }
    }
  }

  // A stale ejection also matches every condition below (its lock entry
  // is deliberately carried forward, nothing produces it, and it exists
  // on disk) — but it is user-owned and informational, not dirty.
  // Excluding the ejected set here keeps it out of `orphaned` and
  // therefore out of the `--check` gate.
  const orphaned = Object.keys(lock?.files ?? {}).filter(path => {
    return (
      !manifestPathSet.has(path) &&
      !ejectedArtifactPaths.has(path) &&
      existsSync(join(skmtcRootPath, '..', path))
    )
  })

  return {
    projectName,
    noManifest: false,
    files,
    orphaned,
    staleEjections,
    counts,
    clean: counts.modified === 0 && orphaned.length === 0
  }
}

const toFileStatus = ({
  path,
  absolutePath,
  detection,
  freshArtifacts
}: {
  path: string
  absolutePath: string
  detection: EditDetectionContext
  freshArtifacts: Record<string, string> | null
}): FileStatus => {
  if (!existsSync(absolutePath)) {
    return 'missing'
  }

  const lockEntry = detection.lock?.files[path]

  if (!lockEntry) {
    return 'unverified'
  }

  const { edited } = classifyDiskFile({
    absolutePath,
    lockEntry,
    detection,
    freshCanonicalContent: freshArtifacts?.[path]
  })

  return edited ? 'modified' : 'clean'
}
