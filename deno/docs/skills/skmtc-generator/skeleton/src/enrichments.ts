import { type EmptyEnrichments, emptyEnrichmentSchema } from '@skmtc/core'

// SLOT(enrichments): the opt-out. To accept per-model options, replace
// with a valibot three-scope umbrella ({ subject, generator, stack }) —
// see "Enrichments and options" in references/engine.md of the
// skmtc-generator skill. Must stay a FUNCTION returning the schema.
export const toEnrichmentSchema = () => emptyEnrichmentSchema

export type EnrichmentSchema = EmptyEnrichments
