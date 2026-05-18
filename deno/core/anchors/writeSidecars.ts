/**
 * @fileoverview Disk writer for sidecars + rollup. Thin I/O wrapper
 * around `buildSidecar` / `entriesForSidecar` outputs. Pure functions
 * (sidecar shape, rollup entries) live elsewhere; this module only
 * handles `Deno.writeTextFile` and the directory layout convention.
 *
 * Path layout (per plan §4.1 + §4.3):
 *
 * ```
 * <outDir>/
 *   <relativeFilePath>.skm.json     ← one sidecar per source file
 *   _rollup.ndjson                  ← project-level reverse-query index
 * ```
 *
 * `outDir` is wholly rewritten per generation — the entire subtree is
 * removed before the new sidecars land. This matches the "stale
 * rollup misleads the viewer" concern in plan §4.3 and keeps the
 * mtime invariant simple for `doctor`'s staleness check.
 *
 * The `outDir` should be gitignored. The `skmtc init` template
 * appends the `.maps` subtree to the project's `.gitignore` by default
 * (plan §9.5 / §12 Q8).
 */

import { join, dirname } from '@std/path'
import type { Sidecar } from './sidecar.ts'
import { toNdjson, type RollupEntry } from './rollup.ts'

export type WriteSidecarsArgs = {
  /** Per-file sidecars produced by the post-pass. Keys are file paths. */
  sidecars: Record<string, Sidecar>
  /** Project-level rollup entries (flat list across all sidecars). */
  rollup: RollupEntry[]
  /**
   * Target directory for sidecars + rollup, typically
   * `<root>/.skmtc/<project>/.maps`. Will be created if it doesn't
   * exist; its contents are removed before writing.
   */
  outDir: string
}

export type WriteSidecarsResult = {
  /** Paths of every file written, relative to `outDir`. */
  written: string[]
  /** Total bytes written across all sidecars + the rollup. */
  totalBytes: number
}

/**
 * Wholly rewrite the sidecar tree at `outDir`. Removes the existing
 * directory (silently — missing is fine) then writes one sidecar per
 * entry plus the rollup NDJSON.
 *
 * Sidecar JSON is pretty-printed for v1 (2-space indent) so a human
 * peeking at the file with `cat` gets a readable view. If size profiles
 * become a concern (plan §9.1 envelope), drop to compact + gzip.
 */
export const writeSidecars = async ({
  sidecars,
  rollup,
  outDir
}: WriteSidecarsArgs): Promise<WriteSidecarsResult> => {
  // Wholly rewrite: nuke the existing tree first. `recursive: true`
  // skips errors if outDir didn't exist (first run after enabling
  // anchors).
  await Deno.remove(outDir, { recursive: true }).catch((err) => {
    if (!(err instanceof Deno.errors.NotFound)) throw err
  })
  await Deno.mkdir(outDir, { recursive: true })

  const written: string[] = []
  let totalBytes = 0

  for (const [filePath, sidecar] of Object.entries(sidecars)) {
    // `${filePath}.skm.json` — sidecar lives alongside the file path
    // it mirrors so re-anchor consumers can flip the extension and
    // find the sidecar.
    const rel = `${filePath}.skm.json`
    const target = join(outDir, rel)
    const dir = dirname(target)
    if (dir !== outDir) {
      await Deno.mkdir(dir, { recursive: true })
    }
    const text = JSON.stringify(sidecar, null, 2)
    await Deno.writeTextFile(target, text)
    written.push(rel)
    totalBytes += text.length
  }

  // Rollup is always written, even when empty — consumers that
  // shell out to `cat .maps/_rollup.ndjson` shouldn't have to
  // distinguish "no anchors yet" from "file doesn't exist".
  const rollupText = toNdjson(rollup)
  await Deno.writeTextFile(join(outDir, '_rollup.ndjson'), rollupText)
  written.push('_rollup.ndjson')
  totalBytes += rollupText.length

  return { written, totalBytes }
}
