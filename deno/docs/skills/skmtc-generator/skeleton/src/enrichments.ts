import { type EmptyEnrichments, emptyEnrichmentSchema } from '@skmtc/core'

// SLOT(enrichments): the opt-out. To accept per-model options, replace
// with a valibot three-scope umbrella ({ subject, generator, stack }) —
// see skmtc-generator §4. Must stay a FUNCTION returning the schema.
export const toEnrichmentSchema = () => emptyEnrichmentSchema

export type EnrichmentSchema = EmptyEnrichments
