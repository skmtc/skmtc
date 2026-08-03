import { type EmptyEnrichments, emptyEnrichmentSchema } from '@skmtc/core'

// SLOT(enrichments): the opt-out. The Kotlin package is FIXED for this
// generator (see BASE_PACKAGE in lib.ts), so there is nothing to
// configure. Must stay a FUNCTION returning the schema.
export const toEnrichmentSchema = () => emptyEnrichmentSchema

export type EnrichmentSchema = EmptyEnrichments
