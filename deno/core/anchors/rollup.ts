/**
 * @fileoverview Rollup index — per-Definition summary used for reverse
 * queries: "which files came from refName User?", "which files did
 * gen-zod produce?". Per plan §4.3.
 *
 * Lives at `.skmtc/<project>/.maps/_rollup.ndjson`, **wholly
 * rewritten** per generation (no accumulation across runs; stale
 * entries would mislead the viewer). The CLI handles disk I/O — this
 * module emits the entries + an NDJSON helper.
 *
 * One entry per Definition (landmark), not per anchor. The landmark
 * appears in the rollup; the per-Snippet anchors stay inside the
 * sidecar itself.
 */

import * as v from 'valibot'
import type { Sidecar } from './sidecar.ts'

/**
 * Single row in the rollup. Mirrors the documented shape in
 * `plan.md` §4.3:
 *
 *  - `f` — file path (relative to basePath)
 *  - `name` — Definition / landmark name
 *  - `g` — generator id (e.g. `@skmtc/gen-typescript`)
 *  - `s` — schema pointer or empty string
 *  - `v` — variant name (default `'main'`)
 */
export const rollupEntry = v.object({
  f: v.string(),
  name: v.string(),
  g: v.string(),
  s: v.string(),
  v: v.string()
})

export type RollupEntry = v.InferOutput<typeof rollupEntry>

/**
 * Extract one rollup entry per unique landmark in `sidecar`.
 *
 * For each landmark, picks the **outermost** anchor — the one whose
 * AST path is empty (meaning the span is the landmark node itself).
 * If no path-empty anchor exists for a landmark (rare; happens when
 * the Definition's full text was reshaped between render and
 * post-pass), falls back to the first anchor for that landmark in
 * document order. This keeps the rollup populated rather than
 * silently dropping a Definition that the user can see in the file.
 */
export const entriesForSidecar = (sidecar: Sidecar): RollupEntry[] => {
  const seen = new Set<number>()
  const out: RollupEntry[] = []

  for (const row of sidecar.A) {
    const [Li, Pi, gi, si, vi] = row
    if (seen.has(Li)) continue

    // Prefer the path-empty row for this landmark if we find one in
    // the remaining sequence; otherwise the first row for this Li
    // already in front of us wins on the next iteration.
    const pathStr = sidecar.P[Pi]
    if (pathStr !== '') {
      // Defer — keep scanning in case a path-empty row for the same
      // landmark exists later.
      const hasOuter = sidecar.A.some(
        ([Lj, Pj]) => Lj === Li && sidecar.P[Pj] === ''
      )
      if (hasOuter) continue
    }

    seen.add(Li)
    out.push({
      f: sidecar.f,
      name: sidecar.L[Li],
      g: sidecar.G[gi]?.name ?? '',
      s: sidecar.S[si] ?? '',
      v: sidecar.V[vi] ?? 'main'
    })
  }

  return out
}

/**
 * Convert rollup entries to NDJSON (newline-delimited JSON). One row
 * per line; trailing newline so concatenation between generations is
 * boundary-safe.
 *
 * Pure: takes entries, returns a string. No I/O.
 */
export const toNdjson = (entries: readonly RollupEntry[]): string =>
  entries.length === 0 ? '' : entries.map(e => JSON.stringify(e)).join('\n') + '\n'

/**
 * Parse an NDJSON rollup file (typically read off disk by the viewer
 * or by a `doctor` check). Invalid rows fail the valibot parse — the
 * rollup is wholly rewritten per generation so a row being unparseable
 * means the file is corrupt, not just stale.
 */
export const parseNdjson = (text: string): RollupEntry[] => {
  if (text.length === 0) return []
  const lines = text.split('\n').filter(line => line.length > 0)
  return lines.map(line => v.parse(rollupEntry, JSON.parse(line)))
}
