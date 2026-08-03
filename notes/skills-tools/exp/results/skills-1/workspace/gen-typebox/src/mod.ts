import { toModelEntry } from '@skmtc/core'
import { TypeboxProjection } from './TypeboxProjection.ts'
import { toEnrichmentSchema, type EnrichmentSchema } from './enrichments.ts'
import denoJson from '../deno.json' with { type: 'json' }

export const typeboxEntry = toModelEntry<EnrichmentSchema>({
  id: denoJson.name,
  toEnrichmentSchema,
  transform({ context, refName }) {
    context.insertModel(TypeboxProjection, refName)
  }
})
