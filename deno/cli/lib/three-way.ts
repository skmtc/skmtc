/**
 * Three-way line analysis for ejected-file drift: given the baseline
 * (what the generator produced when the file was ejected), the user's
 * file (ours), and the current pristine render (theirs), decide
 * whether the user's edits and the generator's changes touch the same
 * regions.
 *
 *   - `non-overlapping` — the edits and the generator's changes occupy
 *     disjoint regions of the baseline; a future `merge` could apply
 *     both mechanically, and reviewing the drift is low-stress.
 *   - `collision` — at least one baseline region was changed by both
 *     sides; a human has to reconcile.
 *
 * Line-based (git merge-file semantics), deliberately conservative:
 * adjacent-but-not-identical regions count as overlapping when they
 * share a boundary line, because a merge would have to order them.
 */

type LineRange = {
  /** Inclusive start line index in the BASE text. */
  start: number
  /** Exclusive end line index in the BASE text. An insertion has start === end. */
  end: number
}

/**
 * Changed regions of `base`, expressed as base-line ranges, computed
 * from an LCS alignment of base against `changed`. Insertions in
 * `changed` appear as empty ranges anchored at the base line they
 * precede.
 */
export const toChangedBaseRanges = (base: string, changed: string): LineRange[] => {
  const baseLines = base.split('\n')
  const changedLines = changed.split('\n')

  const matches = toLcsMatches(baseLines, changedLines)

  const ranges: LineRange[] = []
  let basePosition = 0
  let changedPosition = 0

  for (const [baseIndex, changedIndex] of [...matches, [baseLines.length, changedLines.length]]) {
    const baseGap = baseIndex > basePosition
    const changedGap = changedIndex > changedPosition

    if (baseGap || changedGap) {
      ranges.push({ start: basePosition, end: baseIndex })
    }

    basePosition = baseIndex + 1
    changedPosition = changedIndex + 1
  }

  return ranges
}

/** Standard dynamic-programming LCS over lines, returning matched index pairs. */
const toLcsMatches = (baseLines: string[], changedLines: string[]): Array<[number, number]> => {
  const baseCount = baseLines.length
  const changedCount = changedLines.length

  // lengths[i][j] = LCS length of baseLines[i..] vs changedLines[j..]
  const lengths: number[][] = Array.from({ length: baseCount + 1 }, () =>
    new Array(changedCount + 1).fill(0)
  )

  for (let i = baseCount - 1; i >= 0; i--) {
    for (let j = changedCount - 1; j >= 0; j--) {
      lengths[i][j] =
        baseLines[i] === changedLines[j]
          ? lengths[i + 1][j + 1] + 1
          : Math.max(lengths[i + 1][j], lengths[i][j + 1])
    }
  }

  const matches: Array<[number, number]> = []
  let i = 0
  let j = 0

  while (i < baseCount && j < changedCount) {
    if (baseLines[i] === changedLines[j]) {
      matches.push([i, j])
      i++
      j++
    } else if (lengths[i + 1][j] >= lengths[i][j + 1]) {
      i++
    } else {
      j++
    }
  }

  return matches
}

const rangesTouch = (a: LineRange, b: LineRange): boolean => {
  // Empty ranges (insertions) anchored inside or at the boundary of the
  // other range count as touching — a merge would have to order them.
  return a.start <= b.end && b.start <= a.end
}

export type ThreeWayClassification = 'non-overlapping' | 'collision'

type ClassifyThreeWayArgs = {
  /** The content both sides diverged from (canonical baseline at eject time). */
  base: string
  /** The user's file as it is on disk. */
  ours: string
  /** The current pristine render. */
  theirs: string
}

export const classifyThreeWay = ({
  base,
  ours,
  theirs
}: ClassifyThreeWayArgs): ThreeWayClassification => {
  const ourRanges = toChangedBaseRanges(base, ours)
  const theirRanges = toChangedBaseRanges(base, theirs)

  for (const ourRange of ourRanges) {
    for (const theirRange of theirRanges) {
      if (rangesTouch(ourRange, theirRange)) {
        return 'collision'
      }
    }
  }

  return 'non-overlapping'
}
