import { emptyEnrichmentSchema, toOasOperationEntry } from '@skmtc/core'
import type { EmptyEnrichments } from '@skmtc/core'
import denoJson from './deno.json' with { type: 'json' }
import { transformOperation } from './src/transform.ts'

export const apiClientEntry = toOasOperationEntry<EmptyEnrichments>({
  id: denoJson.name,
  toEnrichmentSchema: () => emptyEnrichmentSchema,
  transform: transformOperation
})

export default apiClientEntry
