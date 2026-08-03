import { toOasOperationEntry } from '@skmtc/core'
import denoJson from '../deno.json' with { type: 'json' }
import { ApiClient } from './ApiClient.ts'
import { toEnrichmentSchema, type EnrichmentSchema } from './enrichments.ts'

export const apiClientEntry = toOasOperationEntry<EnrichmentSchema>({
  id: denoJson.name,
  toEnrichmentSchema,
  transform: ({ context, operation, variant }) => {
    const client =
      context.findDefinition({
        name: ApiClient.toIdentifierName({ operation, enrichments: undefined, variant }),
        exportPath: ApiClient.toExportPath({ operation, enrichments: undefined, variant })
      }) ?? context.insertOperation({ projection: ApiClient, operation, variant }).definition

    const value = client?.value

    if (!(value instanceof ApiClient)) {
      throw new Error('Expected a single ApiClient definition per tag')
    }

    value.append(operation)
  }
})
