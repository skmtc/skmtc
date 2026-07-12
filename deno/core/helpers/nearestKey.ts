/**
 * @fileoverview Nearest-key suggestion for "did you mean …?" hints.
 *
 * Used by the enrichment validation surfaces (`EnrichmentAudit`,
 * `findUnknownKeys`) to pair an unrecognized key with its closest known
 * sibling. Pure string utility — no context, no schema awareness.
 *
 * @module nearestKey
 */

/**
 * Levenshtein edit distance with an early-exit bound: returns
 * `bound + 1` as soon as the distance provably exceeds `bound`, so
 * candidate scans stay cheap on long, unrelated keys.
 */
const editDistance = (a: string, b: string, bound: number): number => {
  if (Math.abs(a.length - b.length) > bound) return bound + 1
  if (a === b) return 0

  let previous = Array.from({ length: b.length + 1 }, (_, index) => index)

  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    let rowMinimum = i

    for (let j = 1; j <= b.length; j++) {
      const substitution = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      const value = Math.min(previous[j] + 1, current[j - 1] + 1, substitution)
      current.push(value)
      rowMinimum = Math.min(rowMinimum, value)
    }

    if (rowMinimum > bound) return bound + 1
    previous = current
  }

  return previous[b.length]
}

/**
 * The candidate closest to `target`, or `undefined` when nothing is close
 * enough to be a plausible typo. A case-only mismatch (`POST` for `post`)
 * always wins; otherwise candidates compete within a small edit-distance
 * budget (1 for short keys, 2 otherwise). An exact match returns
 * `undefined` — a key that exists needs no suggestion.
 */
export const nearestKey = (target: string, candidates: Iterable<string>): string | undefined => {
  const bound = target.length <= 4 ? 1 : 2
  const lowerTarget = target.toLowerCase()

  let best: string | undefined
  let bestDistance = bound + 1

  for (const candidate of candidates) {
    if (candidate === target) return undefined
    if (candidate.toLowerCase() === lowerTarget) return candidate

    const distance = editDistance(target, candidate, bound)
    if (distance < bestDistance) {
      best = candidate
      bestDistance = distance
    }
  }

  return best
}
