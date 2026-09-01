// Ported from deno/desktop/src/lib/gen-map/interval-index.ts (itself from
// apps/main, itself from skmtc-platform/apps/gen-maps).
//
// Spatial lookup for resolved anchors — given a document position, find the
// innermost anchor (smallest byte-range width) containing it. v1 is a linear
// scan; fine for ≤ a few hundred anchors per file. KNOWN LIMIT: O(n) per
// lookup — swap in an interval tree if a large schema produces thousands of
// anchors in one file.

import type { ResolvedAnchor } from '@/lib/provenance/types.ts'

export type IntervalIndex = {
  /** Anchor with the smallest byte-range containing `pos`. */
  innermostContaining(pos: number): ResolvedAnchor | undefined
  /** All anchors containing `pos`, outermost-first → innermost-last. */
  allContaining(pos: number): ResolvedAnchor[]
  size(): number
}

export const buildIntervalIndex = (anchors: ResolvedAnchor[]): IntervalIndex => {
  const entries = anchors.filter(a => a.toByte > a.fromByte)

  return {
    innermostContaining(pos) {
      let best: ResolvedAnchor | undefined
      let bestWidth = Number.POSITIVE_INFINITY
      for (const entry of entries) {
        if (entry.fromByte > pos) continue
        // Half-open: pos exactly at `toByte` is the first byte of the next
        // thing, not inside this anchor (matches editor hover positions).
        if (entry.toByte <= pos) continue
        const width = entry.toByte - entry.fromByte
        if (width < bestWidth) {
          best = entry
          bestWidth = width
        }
      }
      return best
    },
    allContaining(pos) {
      const hits = entries.filter(e => e.fromByte <= pos && e.toByte > pos)
      hits.sort((a, b) => {
        const widthDiff = b.toByte - b.fromByte - (a.toByte - a.fromByte)
        if (widthDiff !== 0) return widthDiff
        return a.fromByte - b.fromByte
      })
      return hits
    },
    size() {
      return entries.length
    }
  }
}
