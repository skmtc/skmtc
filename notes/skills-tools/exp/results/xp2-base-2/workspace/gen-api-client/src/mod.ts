import { toOasOperationEntry } from '@skmtc/core'
import type { OasOperationEntry } from '@skmtc/core'
import { ApiClient } from './ApiClient.ts'
import { toEnrichmentSchema, type EnrichmentSchema } from './enrichments.ts'
import { toClientExportPath, toClientName } from './naming.ts'
import denoJson from '../deno.json' with { type: 'json' }

export const apiClientEntry: OasOperationEntry<EnrichmentSchema> = toOasOperationEntry<EnrichmentSchema>({
  id: denoJson.name,
  toEnrichmentSchema,
  transform({ context, operation }) {
    // The tag's client class is built once, from the first operation
    // carrying the tag; later operations find it already registered.
    const existing = context.findDefinition({
      name: toClientName(operation),
      exportPath: toClientExportPath(operation)
    })

    if (existing) {
      return
    }

    context.insertOperation({ projection: ApiClient, operation })
  }
})
