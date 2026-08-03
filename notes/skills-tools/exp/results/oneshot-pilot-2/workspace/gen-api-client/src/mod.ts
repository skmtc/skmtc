import { toOasOperationEntry } from '@skmtc/core'
import { ApiClient } from './ApiClient.ts'
import { toEnrichmentSchema, type EnrichmentSchema } from './enrichments.ts'
import denoJson from '../deno.json' with { type: 'json' }

export const apiClientEntry = toOasOperationEntry<EnrichmentSchema>({
  id: denoJson.name,
  toEnrichmentSchema,
  transform: ({ context, operation, variant }) => {
    const enrichments = ApiClient.toEnrichments({ operation, context, variant })

    const client =
      context.findDefinition({
        name: ApiClient.toIdentifierName({ operation, enrichments, variant }),
        exportPath: ApiClient.toExportPath({ operation, enrichments, variant })
      }) ?? context.insertOperation({ projection: ApiClient, operation, variant }).definition

    if (!(client?.value instanceof ApiClient)) {
      throw new Error('client must be an instance of ApiClient')
    }

    client.value.append(operation)
  }
})
