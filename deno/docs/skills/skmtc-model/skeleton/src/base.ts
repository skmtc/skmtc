import { camelCase, decapitalize } from '@skmtc/core'
import { toTsModelProjectionBase } from '@skmtc/lang-typescript'
import denoJson from '../deno.json' with { type: 'json' }
import { type EnrichmentSchema, toEnrichmentSchema } from './enrichments.ts'

export const MyLibBase = toTsModelProjectionBase<EnrichmentSchema>({
  id: denoJson.name,

  // SLOT(naming): the emitted binding name, derived from refName ONLY
  // (deterministic; never operationId, never construction-dependent).
  toIdentifierName({ refName }): string {
    return decapitalize(camelCase(refName))
  },

  // SLOT(identifier-kind): 'variable' for schema values; 'type' or
  // 'interface' would make consumers import it type-only.
  toIdentifierType: () => ({ type: 'variable' }),

  // SLOT(export-path): where each model's file lives. '@/' is basePath,
  // and the path after it is always spelled with forward slashes; keep
  // the .generated.ts suffix convention.
  toExportPath({ refName, enrichments, variant }): string {
    const name = this.toIdentifierName({ refName, enrichments, variant })

    return `@/models/${name}.generated.ts`
  },

  toEnrichmentSchema
})
