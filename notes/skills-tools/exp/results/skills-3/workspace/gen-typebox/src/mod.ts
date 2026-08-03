import { toModelEntry } from '@skmtc/core'
import type { ModelEntry } from '@skmtc/core'
import denoJson from '../deno.json' with { type: 'json' }
import { TypeboxProjection } from './TypeboxProjection.ts'
import { toEnrichmentSchema } from './enrichments.ts'
import type { EnrichmentSchema } from './enrichments.ts'

const entry: ModelEntry<EnrichmentSchema> = toModelEntry<EnrichmentSchema>({
  id: denoJson.name,
  toEnrichmentSchema,
  transform({ context, refName, variant }) {
    context.insertModel(TypeboxProjection, refName, { variant })
  }
})

export default entry
