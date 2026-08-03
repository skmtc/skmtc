import { toTsOasOperationProjectionBase } from '@skmtc/lang-typescript'
import { toEnrichmentSchema, type EnrichmentSchema } from './enrichments.ts'
import { toClientExportPath, toClientName } from './naming.ts'
import denoJson from '../deno.json' with { type: 'json' }

export const ApiClientBase = toTsOasOperationProjectionBase<EnrichmentSchema>({
  id: denoJson.name,

  toIdentifierName({ operation }): string {
    return toClientName(operation)
  },

  toIdentifierType: () => ({ type: 'class' }),

  toExportPath({ operation }): string {
    return toClientExportPath(operation)
  },

  toEnrichmentSchema
})
