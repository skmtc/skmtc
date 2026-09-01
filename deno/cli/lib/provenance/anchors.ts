// Ported from deno/desktop/src/lib/gen-map/anchors.ts (itself from
// apps/main). Data bridge: decoded gen-map entries → the `ResolvedAnchor`
// shape the interval index operates on.

import type { GenMapEntry, ResolvedAnchor } from '@/lib/provenance/types.ts'

/**
 * Split a `generatorRef` (`@acme/gen-zod@1.2.3`, or `@acme/gen-zod` when no
 * version) into a version-stripped id + version. The id is the grouping key,
 * so it must be stable across a generator's anchors.
 */
export const splitGeneratorRef = (ref: string): { name: string; version: string } => {
  const at = ref.lastIndexOf('@')
  if (at <= 0) return { name: ref, version: '' }
  return { name: ref.slice(0, at), version: ref.slice(at + 1) }
}

const toSpan = (span: [number, number]): { from: number; to: number } => ({
  from: span[0] ?? 0,
  to: span[1] ?? 0
})

/** Map one gen-map entry to a resolved anchor. */
export const entryToAnchor = (entry: GenMapEntry): ResolvedAnchor => {
  const { from, to } = toSpan(entry.artifactSpan)
  return {
    fromByte: from,
    toByte: to,
    landmark: entry.projectionName,
    producerName: entry.producerName,
    generator: splitGeneratorRef(entry.generatorRef),
    schemaPointer: entry.schemaPointer,
    variant: entry.variant
  }
}

/** Group entries by artifact path. */
export const groupByFile = (entries: GenMapEntry[]): Map<string, GenMapEntry[]> => {
  const byFile = new Map<string, GenMapEntry[]>()
  for (const entry of entries) {
    const list = byFile.get(entry.artifactPath) ?? []
    list.push(entry)
    byFile.set(entry.artifactPath, list)
  }
  return byFile
}

export const anchorsForEntries = (entries: GenMapEntry[]): ResolvedAnchor[] =>
  entries.map(entryToAnchor)
