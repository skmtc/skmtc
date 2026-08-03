import { camelCase, capitalize } from 'jsr:@skmtc/core@0.28.3'
import { toTsModelProjectionBase } from 'jsr:@skmtc/lang-typescript@0.12.17'
import { join } from 'jsr:@std/path@^1.0.9'
import { toEnrichmentSchema, type EnrichmentSchema } from './enrichments.ts'
import denoJson from '../deno.json' with { type: 'json' }

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
