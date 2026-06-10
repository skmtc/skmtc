/**
 * Empty-directory pruning, shared by `clean` and the generate-time
 * artifact prune (`deletePreviousArtifacts`).
 *
 * When generated files are deleted, the directories that held them are
 * often left empty — a half-clean. This prunes those, but only the
 * ones we emptied: the walk starts at each deleted file's parent and
 * climbs, removing a directory only while it is empty, stopping at the
 * first non-empty ancestor. By construction it never touches a folder
 * holding anything we didn't generate.
 *
 * The climb is also bounded by the project's output anchors so it can
 * never delete the anchor itself or anything above it:
 *   - `floorDir` — absolute `basePath`. Never removed; the walk stops
 *     here or above.
 *   - `protectedDirs` — absolute package roots (multi-package output).
 *     Below the floor but still never removed.
 *
 * When `floorDir` can't be determined (no `basePath` in settings),
 * pruning is skipped entirely rather than guessed at — deleting a
 * directory is destructive and a wrong floor could take out `src/`.
 */

import { dirname, join, resolve, SEPARATOR } from '@std/path'
import type { ClientSettings } from '@skmtc/core/Settings'

type AnchorDirs = {
  floorDir: string
  protectedDirs: Set<string>
}

/**
 * Resolve the absolute output anchors from client settings. `basePath`
 * is relative to the app root; each package `rootPath` is relative to
 * `basePath`. Returns `null` when `basePath` is absent — the signal to
 * skip dir pruning.
 */
export const toAnchorDirs = (
  appRoot: string,
  settings: ClientSettings | undefined
): AnchorDirs | null => {
  const basePath = settings?.basePath
  if (basePath === undefined) {
    return null
  }

  const floorDir = resolve(join(appRoot, basePath))
  const protectedDirs = new Set(
    (settings?.packages ?? []).map(pkg => resolve(join(appRoot, basePath, pkg.rootPath)))
  )

  return { floorDir, protectedDirs }
}

type PruneEmptyDirsArgs = {
  /** Absolute paths of the files that were (or, on dry run, would be)
   *  deleted. */
  deletedAbsPaths: string[]
  anchors: AnchorDirs
  dryRun: boolean
}

/**
 * Remove now-empty directories left by a set of deleted files. Returns
 * the absolute paths of the directories removed (or, on a dry run, the
 * ones that would be removed). Deepest-first so a parent is only judged
 * after its prunable children are gone.
 */
export const pruneEmptyDirs = ({
  deletedAbsPaths,
  anchors,
  dryRun
}: PruneEmptyDirsArgs): string[] => {
  const { floorDir, protectedDirs } = anchors

  // Gather every candidate ancestor dir of every deleted file, bounded
  // by the floor and the protected set.
  const candidates = new Set<string>()
  for (const filePath of deletedAbsPaths) {
    let dir = resolve(dirname(filePath))
    while (isPrunable(dir, floorDir, protectedDirs)) {
      candidates.add(dir)
      dir = resolve(join(dir, '..'))
    }
  }

  // Deepest first: removing a child before its parent is evaluated lets
  // the parent's emptiness check (real or simulated) see the removal.
  const ordered = [...candidates].sort((a, b) => toDepth(b) - toDepth(a))

  const deleteSet = new Set(deletedAbsPaths.map(p => resolve(p)))
  const removed = new Set<string>()

  for (const dir of ordered) {
    if (dryRun) {
      // Simulate: the dir would be empty if every current entry is
      // either a file we're deleting or a subdir we've already decided
      // to remove.
      if (wouldBeEmpty(dir, deleteSet, removed)) {
        removed.add(dir)
      }
      continue
    }

    // Real run: files are already gone, so read the live directory.
    try {
      const empty = [...Deno.readDirSync(dir)].length === 0
      if (empty) {
        Deno.removeSync(dir)
        removed.add(dir)
      }
    } catch {
      // Ignore — a vanished or unreadable dir is not worth aborting for.
    }
  }

  return [...removed]
}

const isPrunable = (dir: string, floorDir: string, protectedDirs: Set<string>): boolean => {
  // Never the floor or above it, never a protected package root.
  if (dir === floorDir) return false
  if (!dir.startsWith(floorDir + SEPARATOR)) return false
  if (protectedDirs.has(dir)) return false
  return true
}

const wouldBeEmpty = (dir: string, deleteSet: Set<string>, removed: Set<string>): boolean => {
  let entries: Deno.DirEntry[]
  try {
    entries = [...Deno.readDirSync(dir)]
  } catch {
    return false
  }

  return entries.every(entry => {
    const entryPath = resolve(join(dir, entry.name))
    return entry.isDirectory ? removed.has(entryPath) : deleteSet.has(entryPath)
  })
}

const toDepth = (path: string): number => path.split(SEPARATOR).length
