import { emptyEnrichmentSchema } from 'jsr:@skmtc/core@0.28.3'

export const toEnrichmentSchema = () => emptyEnrichmentSchema

export type EnrichmentSchema = Record<string, never>
