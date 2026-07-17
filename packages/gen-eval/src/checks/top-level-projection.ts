import type { PackageFacts } from '../types.ts'

/**
 * Check 5 — at least one top-level Projection exists. Exempt only for
 * generators with a confirmed accumulator verdict (check 6).
 * Docs: docs/top-level-projection.md
 */

export type TopLevelProjectionResult = { pass: boolean; exempt: boolean }

export const runTopLevelProjection = (facts: PackageFacts): TopLevelProjectionResult => {
  const hasProjection = facts.classes.some(item => item.kind === 'projection')
  return { pass: hasProjection, exempt: !hasProjection && facts.accumulator.verdict }
}
