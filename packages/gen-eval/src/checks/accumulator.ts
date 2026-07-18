import type { AccumulatorReport, PackageFacts } from '../types.ts'

/**
 * Check 6 — evidence-based accumulator detection. The verdict itself is
 * computed in the shared facts pass (parse.ts) because checks 3 and 5
 * key their exemptions off it; this module reports it.
 * Docs: docs/accumulator.md
 */

export const runAccumulator = (facts: PackageFacts): AccumulatorReport => facts.accumulator
