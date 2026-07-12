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

export type LineRange = {
  /** Inclusive start line index in the BASE text. */
  start: number
  /** Exclusive end line index in the BASE text. An insertion has start === end. */
  end: number
}

/**
 * A changed region of `base`: the base-line range it replaces and the
 * lines from the changed side that replace it (empty for a deletion;
 * an insertion has `start === end`).
 */
export type ChangedRegion = LineRange & {
  replacement: string[]
}

/**
 * Changed regions of `base`, computed from an LCS alignment of base
 * against `changed`. Insertions in `changed` appear as empty ranges
 * anchored at the base line they precede.
 */
export const toChangedRegions = (base: string, changed: string): ChangedRegion[] => {
  const baseLines = base.split('\n')
  const changedLines = changed.split('\n')

  const matches = toLcsMatches(baseLines, changedLines)

  const regions: ChangedRegion[] = []
  let basePosition = 0
  let changedPosition = 0

  for (const [baseIndex, changedIndex] of [...matches, [baseLines.length, changedLines.length]]) {
    const baseGap = baseIndex > basePosition
    const changedGap = changedIndex > changedPosition

    if (baseGap || changedGap) {
      regions.push({
        start: basePosition,
        end: baseIndex,
        replacement: changedLines.slice(changedPosition, changedIndex)
      })
    }

    basePosition = baseIndex + 1
    changedPosition = changedIndex + 1
  }

  return regions
}

/** The ranges-only view of {@link toChangedRegions}, for classification. */
export const toChangedBaseRanges = (base: string, changed: string): LineRange[] => {
  return toChangedRegions(base, changed).map(({ start, end }) => ({ start, end }))
}

/**
 * Upper bound on the LCS DP table, in cells
 * (`(baseLines + 1) × (changedLines + 1)`). The table is O(n·m) time
 * and memory, so a pair of ~10,000-line files would allocate on the
 * order of a gigabyte. 4M cells (~2,000 × 2,000 lines) keeps the
 * allocation in the tens of megabytes; callers must check
 * {@link isLineDiffable} / {@link isThreeWayDiffable} and degrade
 * (skip classification, refuse merge) above it. An O(ND) Myers diff
 * would lift the limit — noted as a follow-up.
 */
export const MAX_DIFF_CELLS = 4_000_000

const countLines = (text: string): number => {
  let count = 1
  for (let index = 0; index < text.length; index++) {
    if (text[index] === '\n') {
      count++
    }
  }
  return count
}

/** Whether a base/changed pair is small enough for the line diff. */
export const isLineDiffable = (base: string, changed: string): boolean => {
  return (countLines(base) + 1) * (countLines(changed) + 1) <= MAX_DIFF_CELLS
}

/** Whether all three sides are small enough to classify or merge. */
export const isThreeWayDiffable = ({ base, ours, theirs }: ClassifyThreeWayArgs): boolean => {
  return isLineDiffable(base, ours) && isLineDiffable(base, theirs)
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

export type MergeThreeWayResult =
  | { ok: true; merged: string }
  | {
      ok: false
      /** Base-line ranges where the two sides' changes touch. */
      collisions: LineRange[]
    }

/**
 * Applies both sides' changes to the base when they don't overlap —
 * the mechanical half of drift resolution: keep the user's edits, take
 * the generator's updates. Refuses (returning the colliding base
 * ranges) rather than producing conflict markers: a merged file is
 * written whole or not at all.
 */
const isSameRegion = (a: ChangedRegion, b: ChangedRegion): boolean => {
  return (
    a.start === b.start &&
    a.end === b.end &&
    a.replacement.length === b.replacement.length &&
    a.replacement.every((line, index) => line === b.replacement[index])
  )
}

export const mergeThreeWay = ({
  base,
  ours,
  theirs
}: ClassifyThreeWayArgs): MergeThreeWayResult => {
  const ourRegions = toChangedRegions(base, ours)
  const theirRegions = toChangedRegions(base, theirs)

  const collisions: LineRange[] = []
  for (const ourRegion of ourRegions) {
    for (const theirRegion of theirRegions) {
      // Identical changes on both sides are not a conflict (git
      // merge-file semantics): the user hand-applying the generator's
      // update must not make `merge` refuse.
      if (isSameRegion(ourRegion, theirRegion)) {
        continue
      }
      if (rangesTouch(ourRegion, theirRegion)) {
        collisions.push({
          start: Math.min(ourRegion.start, theirRegion.start),
          end: Math.max(ourRegion.end, theirRegion.end)
        })
      }
    }
  }

  if (collisions.length > 0) {
    return { ok: false, collisions }
  }

  // Splice both sides into the base, back to front so earlier indices
  // stay valid. Regions identical on both sides are applied once.
  const merged = base.split('\n')
  const allRegions = [
    ...ourRegions,
    ...theirRegions.filter(
      theirRegion => !ourRegions.some(ourRegion => isSameRegion(ourRegion, theirRegion))
    )
  ].sort((a, b) => b.start - a.start)

  for (const region of allRegions) {
    merged.splice(region.start, region.end - region.start, ...region.replacement)
  }

  return { ok: true, merged: merged.join('\n') }
}
