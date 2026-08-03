import { emptyEnrichmentSchema, type EmptyEnrichments } from '@skmtc/core'
import { toTsOasOperationProjectionBase } from '@skmtc/lang-typescript'
import { toClientName, toClientPath } from './naming.ts'
import denoJson from '../deno.json' with { type: 'json' }

export const TagClientBase = toTsOasOperationProjectionBase<EmptyEnrichments>({
  id: denoJson.name,

  toIdentifierName({ operation }): string {
    return toClientName(operation)
  },

  toIdentifierType: () => ({ type: 'class' }),

  toExportPath({ operation }): string {
    return toClientPath(operation)
  },

  toEnrichmentSchema: () => emptyEnrichmentSchema
})
