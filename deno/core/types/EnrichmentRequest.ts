import type * as v from 'valibot'

export type EnrichmentRequest<EnrichmentType = undefined> = {
  prompt: string
  enrichmentSchema: v.BaseSchema<EnrichmentType, EnrichmentType, v.BaseIssue<unknown>>
  content: string
}
