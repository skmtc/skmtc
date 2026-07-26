import type { MethodDisciplineReport, PackageFacts, ProducerKind } from '../types.ts'

/**
 * Check 3 — producers carry no methods beyond constructor + toString.
 * When the accumulator verdict (check 6) holds, the exemption covers the
 * container producers' MUTATOR methods only — a container's other extra
 * methods (rendering helpers and the like) are still flagged.
 * Docs: docs/method-discipline.md
 */

export const runMethodDiscipline = (facts: PackageFacts): MethodDisciplineReport => {
  const mutatorsByClass = new Map(
    facts.accumulator.verdict
      ? facts.accumulator.containerProducers.map(
          container => [container.className, new Set(container.mutatorMethods)] as const
        )
      : []
  )

  const toEntry = (
    item: PackageFacts['producers'][number],
    extraMethods: string[]
  ): MethodDisciplineReport['flagged'][number] => {
    const kind: ProducerKind = item.kind === 'projection' ? 'projection' : 'snippet'
    return { className: item.className, kind, extraMethods }
  }

  const split = facts.producers
    .filter(item => item.extraMethods.length > 0)
    .map(item => {
      const mutators = mutatorsByClass.get(item.className)
      return {
        item,
        exempt: item.extraMethods.filter(method => mutators?.has(method)),
        remaining: item.extraMethods.filter(method => !mutators?.has(method))
      }
    })

  const flagged = split
    .filter(entry => entry.remaining.length > 0)
    .map(entry => toEntry(entry.item, entry.remaining))
  const accumulatorExempt = split
    .filter(entry => entry.exempt.length > 0)
    .map(entry => toEntry(entry.item, entry.exempt))

  return {
    producers: facts.producers.length,
    clean: facts.producers.length - flagged.length,
    flagged,
    accumulatorExempt
  }
}
