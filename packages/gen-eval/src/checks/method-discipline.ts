import type { MethodDisciplineReport, PackageFacts, ProducerKind } from '../types.ts'

/**
 * Check 3 — producers carry no methods beyond constructor + toString.
 * Container-producer mutators are exempt when the accumulator verdict
 * (check 6) holds. Docs: docs/method-discipline.md
 */

export const runMethodDiscipline = (facts: PackageFacts): MethodDisciplineReport => {
  const exemptClassNames = new Set(
    facts.accumulator.verdict
      ? facts.accumulator.containerProducers.map(container => container.className)
      : []
  )

  const withExtras = facts.producers.filter(item => item.extraMethods.length > 0)
  const toEntry = (item: (typeof withExtras)[number]) => {
    const kind: ProducerKind = item.kind === 'projection' ? 'projection' : 'snippet'
    return { className: item.className, kind, extraMethods: item.extraMethods }
  }

  const flagged = withExtras.filter(item => !exemptClassNames.has(item.className)).map(toEntry)
  const accumulatorExempt = withExtras
    .filter(item => exemptClassNames.has(item.className))
    .map(toEntry)

  return {
    producers: facts.producers.length,
    clean: facts.producers.length - flagged.length,
    flagged,
    accumulatorExempt
  }
}
