import { toModelEntry } from '@skmtc/core'
import { EffectSchemaProjection } from './EffectSchemaProjection.ts'
import { toEnrichmentSchema, type EnrichmentSchema } from './enrichments.ts'
import denoJson from '../deno.json' with { type: 'json' }

/**
 * The generator entry: for every component schema in the document, insert
 * the effect Schema projection. Everything else — one file per model,
 * `$ref` deduplication, imports — falls out of the projection's export path
 * and the engine's model driver.
 */
export const effectSchemaEntry = toModelEntry<EnrichmentSchema>({
  id: denoJson.name,
  toEnrichmentSchema,
  transform({ context, refName }) {
    context.insertModel(EffectSchemaProjection, refName)
  }
})
