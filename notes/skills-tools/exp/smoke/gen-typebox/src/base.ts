import { camelCase, capitalize } from '@skmtc/core'
import { toTsModelProjectionBase } from '@skmtc/lang-typescript'
import { join } from '@std/path'
import denoJson from '../deno.json' with { type: 'json' }
import { toEnrichmentSchema, type EnrichmentSchema } from './enrichments.ts'

export const TypeBoxBase = toTsModelProjectionBase<EnrichmentSchema>({
  id: denoJson.name,

  toIdentifierName({ refName }): string {
    return capitalize(camelCase(refName))
  },

  toIdentifierType: () => ({ type: 'variable' }),

  toExportPath({ refName, enrichments, variant }): string {
    const name = this.toIdentifierName({ refName, enrichments, variant })

    return join('@', 'models', `${name}.generated.ts`)
  },

  toEnrichmentSchema
})
