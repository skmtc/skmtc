import { camelCase, capitalize } from '@skmtc/core'
import { toTsModelProjectionBase } from '@skmtc/lang-typescript'
import { join } from '@std/path'
import denoJson from '../deno.json' with { type: 'json' }
import { toEnrichmentSchema } from './enrichments.ts'
import type { TypeboxEnrichments } from './enrichments.ts'

export const TypeboxBase: ReturnType<typeof toTsModelProjectionBase<TypeboxEnrichments>> =
  toTsModelProjectionBase<TypeboxEnrichments>({
  id: denoJson.name,
  toIdentifierName({ refName }) {
    return capitalize(camelCase(refName))
  },
  toIdentifierType: () => ({ type: 'variable' }),
  toExportPath({ refName, enrichments, variant }) {
    const name = this.toIdentifierName({ refName, enrichments, variant })

    return join('@', 'models', `${name}.generated.ts`)
  },
  toEnrichmentSchema
})
