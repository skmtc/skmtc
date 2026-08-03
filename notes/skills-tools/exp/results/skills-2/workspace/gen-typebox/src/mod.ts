import { toModelEntry } from '@skmtc/core'
import type { ModelEntry } from '@skmtc/core'
import denoJson from '../deno.json' with { type: 'json' }
import { toEnrichmentSchema } from './enrichments.ts'
import type { TypeboxEnrichments } from './enrichments.ts'
import { TypeboxProjection } from './Typebox.ts'

export const entry: ModelEntry<TypeboxEnrichments> = toModelEntry<TypeboxEnrichments>({
  id: denoJson.name,
  toEnrichmentSchema,
  transform({ context, refName }) {
    context.insertModel(TypeboxProjection, refName)
  }
})

export default entry
