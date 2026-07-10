/**
 * Headless `status` path — classifies every generated file a project's
 * manifest records against the generated lock, answering "what does
 * the tool think is going on?" without touching anything:
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
 * Read-only by design: safe to run any time, including CI (`--check`
 * turns a dirty status into a non-zero exit).
 */

import { join } from '@std/path/join'
import { resolve } from '@std/path/resolve'
import { existsSync } from '@std/fs/exists'
import type { ClientSettings } from '@skmtc/core/Settings'
import { Manifest } from '@/lib/manifest.ts'
import { toRootPath } from '@/lib/to-root-path.ts'
import { readGeneratedLock, toGeneratedLockPath } from '@/lib/generated-lock.ts'
import { toBaselinesDir } from '@/lib/baseline-store.ts'
import { classifyDiskFile, type EditDetectionContext } from '@/lib/edit-detection.ts'
import { toEjectedArtifactPaths } from '@/lib/write-generated-files.ts'
import {
  type EjectionFileState,
  readEjectionState,
  toEjectionStatePath
} from '@/lib/ejection-state.ts'

export type FileStatus = 'clean' | 'modified' | 'missing' | 'unverified' | 'ejected'

export type StatusFileEntry = {
  path: string
  status: FileStatus
  /**
   * For `ejected` files: the drift state from the last generate run
   * (read from the gitignored ejection-state file the writer emits).
   * Absent when no generate has run since ejecting.
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
   * Ejected files no longer produced by any generator (from the last
   * generate's ejection state) — the schema item was removed or
   * renamed. The files stay the user's; listed so they aren't
   * forgotten.
   */
  staleEjections: string[]
  counts: Record<FileStatus, number>
  /** True when nothing needs attention (no modified, no orphaned). */
  clean: boolean
}

type StatusHeadlessArgs = {
  projectName: string
  clientSettings: ClientSettings | undefined
  /** Workspace root (`.skmtc`). Defaults to the cwd-derived
   *  `toRootPath()`. Injectable so tests can point at a temp workspace
   *  without depending on `Deno.cwd()`. */
  skmtcRootPath?: string
}

export const statusHeadless = async ({
  projectName,
  clientSettings,
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
    baselinesDir: toBaselinesDir(projectPath),
    appRoot
  }

  const files: StatusFileEntry[] = []
  const counts = { ...emptyCounts }
  const ejectedArtifactPaths = toEjectedArtifactPaths(clientSettings)
  const ejectionState = readEjectionState(toEjectionStatePath(projectPath))

  const manifestPaths = Object.keys(manifest.contents.files)

  for (const path of manifestPaths) {
    const absolutePath = join(skmtcRootPath, '..', path)

    // Ejected files are user-owned by declaration — expected to differ
    // from generated output, so they get their own status instead of
    // reading as `modified`.
    const isEjected: boolean =
      manifest.contents.files[path].ejected === true || ejectedArtifactPaths.has(path)
    const status = isEjected ? 'ejected' : toFileStatus({ path, absolutePath, detection })

    const ejection = isEjected ? ejectionState.files[path] : undefined

    files.push({ path, status, ...(ejection ? { ejection } : {}) })
    counts[status] += 1
  }

  // Ejected files the last generate reported as stale don't appear in
  // the manifest (nothing produces them) — surface them separately.
  const manifestPathSetForStale = new Set(manifestPaths)
  const staleEjections = Object.entries(ejectionState.files)
    .filter(([path, state]) => state.state === 'stale' && !manifestPathSetForStale.has(path))
    .map(([path]) => path)

  const manifestPathSet = new Set(manifestPaths)

  const orphaned = Object.keys(lock?.files ?? {}).filter(path => {
    return !manifestPathSet.has(path) && existsSync(join(skmtcRootPath, '..', path))
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
  detection
}: {
  path: string
  absolutePath: string
  detection: EditDetectionContext
}): FileStatus => {
  if (!existsSync(absolutePath)) {
    return 'missing'
  }

  const lockEntry = detection.lock?.files[path]

  if (!lockEntry) {
    return 'unverified'
  }

  const { edited } = classifyDiskFile({ artifactPath: path, absolutePath, lockEntry, detection })

  return edited ? 'modified' : 'clean'
}
