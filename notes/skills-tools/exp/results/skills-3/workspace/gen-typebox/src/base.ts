import { camelCase } from '@skmtc/core'
import { sanitizeIdentifier, toTsModelProjectionBase } from '@skmtc/lang-typescript'
import { join } from '@std/path'
import denoJson from '../deno.json' with { type: 'json' }
import { toEnrichmentSchema } from './enrichments.ts'
import type { EnrichmentSchema } from './enrichments.ts'

export const TypeboxBase: ReturnType<typeof toTsModelProjectionBase<EnrichmentSchema>> =
  toTsModelProjectionBase<EnrichmentSchema>({
  id: denoJson.name,
  toIdentifierName({ refName }) {
    return sanitizeIdentifier(camelCase(refName, { upperFirst: true }))
  },
  toIdentifierType: () => ({ type: 'variable' }),
  toExportPath({ refName, enrichments, variant }) {
    const name = this.toIdentifierName({ refName, enrichments, variant })
    return join('@', 'models', `${name}.generated.ts`)
  },
  toEnrichmentSchema
})
