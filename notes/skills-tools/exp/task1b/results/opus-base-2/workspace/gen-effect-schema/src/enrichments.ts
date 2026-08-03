import { emptyEnrichmentSchema, type EmptyEnrichments } from '@skmtc/core'

/** This generator takes no user enrichments — the empty umbrella. */
export const toEnrichmentSchema = () => emptyEnrichmentSchema

export type EnrichmentSchema = EmptyEnrichments
