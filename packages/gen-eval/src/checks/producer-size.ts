import type { PackageFacts } from '../types.ts'

/** Check 7 — producer size in lines, bucketed to the nearest 50. Docs: docs/producer-size.md */

export type ProducerSizeResult = { bucket: number; count: number }[]

export const runProducerSize = (facts: PackageFacts): ProducerSizeResult => {
  const sizeCounts = new Map<number, number>()
  for (const producer of facts.producers) {
    sizeCounts.set(producer.sizeBucket, (sizeCounts.get(producer.sizeBucket) ?? 0) + 1)
  }
  return [...sizeCounts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(entry => ({ bucket: entry[0], count: entry[1] }))
}
