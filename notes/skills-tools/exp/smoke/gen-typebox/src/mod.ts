import { toModelEntry } from '@skmtc/core'
import denoJson from '../deno.json' with { type: 'json' }
import { toEnrichmentSchema, type EnrichmentSchema } from './enrichments.ts'
import { TypeBoxProjection } from './TypeBoxProjection.ts'

export const typeboxEntry = toModelEntry<EnrichmentSchema>({
  id: denoJson.name,
  toEnrichmentSchema,
  transform({ context, refName }) {
    context.insertModel(TypeBoxProjection, refName)
  }
})
