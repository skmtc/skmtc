import { capitalize } from 'jsr:@skmtc/core@0.28.3'
import { toTsOasOperationProjectionBase } from 'jsr:@skmtc/lang-typescript@0.12.17'
import { toEnrichmentSchema, type EnrichmentSchema } from './enrichments.ts'
import denoJson from '../deno.json' with { type: 'json' }

export const ClientClassBase = toTsOasOperationProjectionBase<EnrichmentSchema>({
  id: denoJson.name,
  toIdentifierName({ operation }) {
    const tag = operation.tags?.[0] || 'default'
    return capitalize(tag) + 'Client'
  },
  toIdentifierType: () => ({ type: 'class' }),
  toExportPath({ operation }) {
    const tag = operation.tags?.[0] || 'default'
    return `@/client/${capitalize(tag)}Client.generated.ts`
  },
  toEnrichmentSchema
})
