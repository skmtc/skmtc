import type { PackageFacts } from '../types.ts'

/** Check 2 — the generator primarily consists of producers. Docs: docs/producer-share.md */

export type ProducerShareResult = {
  classTotals: { projections: number; snippets: number; other: number }
  producerShare: number
  helperFunctions: string[]
}

export const runProducerShare = (facts: PackageFacts): ProducerShareResult => {
  const projections = facts.classes.filter(item => item.kind === 'projection').length
  const snippets = facts.classes.filter(item => item.kind === 'snippet').length
  const other = facts.classes.filter(item => item.kind === 'other').length
  return {
    classTotals: { projections, snippets, other },
    producerShare: facts.classes.length === 0 ? 0 : (projections + snippets) / facts.classes.length,
    helperFunctions: facts.helperFunctions
  }
}
