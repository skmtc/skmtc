import { toModelEntry } from 'jsr:@skmtc/core@0.28.3'
import { TypeBoxProjection } from './TypeBoxProjection.ts'
import { toEnrichmentSchema, type EnrichmentSchema } from './enrichments.ts'
import denoJson from '../deno.json' with { type: 'json' }

export const typeboxEntry = toModelEntry<EnrichmentSchema>({
  id: denoJson.name,
  toEnrichmentSchema,
  transform({ context, refName }) {
    context.insertModel(TypeBoxProjection, refName)
  }
})
