import { toTsOasOperationProjectionBase } from '@skmtc/lang-typescript'
import denoJson from '../deno.json' with { type: 'json' }
import { toEnrichmentSchema, type EnrichmentSchema } from './enrichments.ts'
import { toClientName } from './naming.ts'

export const ApiClientBase = toTsOasOperationProjectionBase<EnrichmentSchema>({
  id: denoJson.name,
  toIdentifierName({ operation }) {
    return toClientName(operation)
  },
  toIdentifierType: () => ({ type: 'class' }),
  toExportPath({ operation }) {
    return ['@', 'client', `${toClientName(operation)}.generated.ts`].join('/')
  },
  toEnrichmentSchema
})
