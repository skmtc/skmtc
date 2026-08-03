import { toModelEntry } from '@skmtc/core'
import denoJson from '../deno.json' with { type: 'json' }
import { type EnrichmentSchema, toEnrichmentSchema } from './enrichments.ts'
import { KotlinProjection } from './KotlinProjection.ts'

export const kotlinJacksonEntry = toModelEntry<EnrichmentSchema>({
  id: denoJson.name,
  toEnrichmentSchema,
  transform({ context, refName }) {
    context.insertModel(KotlinProjection, refName)
  },
})
