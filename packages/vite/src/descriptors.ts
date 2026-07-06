// Read the moduleType contract off the describe payload's enrichment
// descriptors. A moduleSelect field carries the TS source of the contract a
// chosen module must satisfy (`export type XModule<F> = …`) — declared on the
// generator's enrichment schema and emitted by core's toEnrichmentDescriptor.
// This replaced the old manifest-mappings transport (toMappingModule), which
// core 0.24 removed.

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

// Depth-first over EnrichmentField trees (object `fields`, array `item`).
// `item` is a single EnrichmentField on current cores (the discriminated-union
// descriptor shape); older cores emitted a one-element array — accept both,
// since the describe payload comes from whatever core the project pins.
const moduleTypeInFields = (fields: unknown): string | undefined => {
  const list = Array.isArray(fields) ? fields : isRecord(fields) ? [fields] : []
  for (const field of list) {
    if (!isRecord(field)) continue
    if (field.type === 'moduleSelect' && typeof field.moduleType === 'string') {
      return field.moduleType
    }
    const nested = moduleTypeInFields(field.fields) ?? moduleTypeInFields(field.item)
    if (nested !== undefined) return nested
  }
  return undefined
}

/**
 * The moduleType declared by `generator`'s (single) moduleSelect field, read
 * from the describe payload. Undefined when the generator declares none —
 * the matcher then falls back to the built-in lens/input contract (covers
 * generators that haven't adopted moduleSelect).
 */
export const moduleTypeFromDescribe = (
  describeData: unknown,
  generator: string
): string | undefined => {
  if (!isRecord(describeData) || !Array.isArray(describeData.descriptors)) return undefined
  for (const descriptor of describeData.descriptors) {
    if (!isRecord(descriptor) || descriptor.generator !== generator) continue
    return moduleTypeInFields(descriptor.fields)
  }
  return undefined
}
