/**
 * Headless `clean` path — deletes every generated file recorded in a
 * project's manifest, prunes the directories that held them, then
 * removes the manifest itself, returning the project to its
 * pre-generation state. The inverse of the write half of `generate`.
 *
 * Where `deletePreviousArtifacts` (see {@link lib/write-generated-files.ts})
 * prunes only the files the *next* run won't rewrite, `clean` removes
 * the full set — it's `make clean`, not an incremental prune.
 *
 * Strict mode invokes this directly. A `dryRun` enumerates what would
 * be deleted without touching disk — recommended before a real run
 * since the operation is destructive and not undoable.
 */

import { join } from '@std/path/join'
import { resolve } from '@std/path/resolve'
import { relative } from '@std/path/relative'
import { existsSync } from '@std/fs/exists'
import type { ClientSettings } from '@skmtc/core/Settings'
import { Manifest } from '@/lib/manifest.ts'
import { toRootPath } from '@/lib/to-root-path.ts'
import { pruneEmptyDirs, toAnchorDirs } from '@/lib/prune-empty-dirs.ts'
import { toEjectedArtifactPaths } from '@/lib/write-generated-files.ts'
import { readGeneratedLock, toGeneratedLockPath } from '@/lib/generated-lock.ts'
import { toBaselinesDir } from '@/lib/baseline-store.ts'
import { classifyDiskFile, type EditDetectionContext } from '@/lib/edit-detection.ts'

type CleanHeadlessArgs = {
  projectName: string
  dryRun: boolean
  /** Output anchors from the project's client.json — used to bound
   *  empty-dir pruning. When absent (no basePath), dirs aren't pruned. */
  clientSettings: ClientSettings | undefined
  /** Workspace root (`.skmtc`). Defaults to the cwd-derived
   *  `toRootPath()`. Injectable so tests can point at a temp workspace
   *  without depending on `Deno.cwd()`. */
  skmtcRootPath?: string
}

export type CleanHeadlessResult = {
  projectName: string
  dryRun: boolean
  /** Manifest-recorded paths that existed on disk (deleted, or — in a
   *  dry run — would be deleted). BasePath-relative, as the manifest
   *  stores them. */
  deleted: string[]
  /** Manifest-recorded paths already absent from disk — nothing to do. */
  missing: string[]
  /** Manifest-recorded paths that resolved outside the app root and
   *  were refused as a safety guard. Empty in normal operation. */
  skipped: string[]
  /** Ejected (user-owned) paths — never deleted, listed for visibility. */
  ejected: string[]
  /**
   * Deleted paths that carried manual edits (per the generated lock) —
   * `clean` removes the full generated set including these, but a hand
   * edit the system knows about must never be destroyed *silently*.
   */
  modified: string[]
  /** Directories removed (or, on a dry run, that would be removed)
   *  because deleting the files left them empty. App-root-relative. */
  removedDirs: string[]
  /** Whether the manifest file itself was removed (false on dry run or
   *  when there was no manifest to begin with). */
  manifestRemoved: boolean
  /** True when the project had no manifest — `clean` is a no-op. */
  noManifest: boolean
}

export const cleanHeadless = async ({
  projectName,
  dryRun,
  clientSettings,
  skmtcRootPath = toRootPath()
}: CleanHeadlessArgs): Promise<CleanHeadlessResult> => {
  const appRoot = resolve(join(skmtcRootPath, '..'))
  const manifestPath = join(skmtcRootPath, projectName, '.settings', 'manifest.json')

  const manifest = await Manifest.openFromPath(projectName, manifestPath)

  if (manifest.contents === null) {
    // No manifest (never generated, or stale/malformed → tolerant
    // read degraded to null). Nothing to clean.
    return {
      projectName,
      dryRun,
      deleted: [],
      missing: [],
      skipped: [],
      ejected: [],
      modified: [],
      removedDirs: [],
      manifestRemoved: false,
      noManifest: true
    }
  }

  const deleted: string[] = []
  const missing: string[] = []
  const skipped: string[] = []
  const ejected: string[] = []
  const modified: string[] = []
  const deletedAbsPaths: string[] = []
  const ejectedArtifactPaths = toEjectedArtifactPaths(clientSettings)

  const lock = readGeneratedLock(toGeneratedLockPath(manifestPath))
  const detection: EditDetectionContext = {
    lock,
    formatterCommand: clientSettings?.formatter,
    baselinesDir: toBaselinesDir(join(skmtcRootPath, projectName)),
    appRoot
  }

  for (const [path, entry] of Object.entries(manifest.contents.files)) {
    const absolutePath = join(skmtcRootPath, '..', path)

    // Ejected files are the user's — `clean` removes generated output,
    // and these are no longer generated output. Belt and braces: honor
    // both the manifest annotation and the client.json ejected set.
    if (entry.ejected || ejectedArtifactPaths.has(path)) {
      ejected.push(path)
      continue
    }

    // Containment guard: generated files always live under the app
    // root. A manifest key that escapes it (a stray `..` segment) is
    // refused rather than deleted — this command is destructive and
    // not undoable.
    if (!resolve(absolutePath).startsWith(appRoot)) {
      skipped.push(path)
      continue
    }

    if (!existsSync(absolutePath)) {
      missing.push(path)
      continue
    }

    // Deleted either way (clean removes the FULL generated set), but a
    // file the lock knows is hand-edited is reported, never destroyed
    // silently. Use --dry-run to see these before a real run.
    const lockEntry = lock?.files[path]
    if (
      lockEntry &&
      classifyDiskFile({ artifactPath: path, absolutePath, lockEntry, detection }).edited
    ) {
      modified.push(path)
    }

    if (!dryRun) {
      try {
        Deno.removeSync(absolutePath)
      } catch {
        // Treat an unexpected delete failure as "already gone" rather
        // than aborting the whole clean — match the tolerant stance of
        // `deletePreviousArtifacts`.
        missing.push(path)
        continue
      }
    }

    deleted.push(path)
    deletedAbsPaths.push(absolutePath)
  }

  // Prune directories the deletions emptied, bounded by the output
  // anchors so the walk can never remove basePath or a package root.
  const anchors = toAnchorDirs(appRoot, clientSettings)
  const removedDirs = anchors
    ? pruneEmptyDirs({ deletedAbsPaths, anchors, dryRun }).map(dir => relative(appRoot, dir))
    : []

  let manifestRemoved = false
  if (!dryRun) {
    try {
      Deno.removeSync(manifestPath)
      manifestRemoved = true
    } catch {
      // Leave manifestRemoved false; the next `generate` rewrites it.
    }
  }

  return {
    projectName,
    dryRun,
    deleted,
    missing,
    skipped,
    ejected,
    modified,
    removedDirs,
    manifestRemoved,
    noManifest: false
  }
}
