import { emptyEnrichmentSchema } from '@skmtc/core'
import type { EmptyEnrichments } from '@skmtc/core'

export type EnrichmentSchema = EmptyEnrichments

export const toEnrichmentSchema = (): typeof emptyEnrichmentSchema => emptyEnrichmentSchema
