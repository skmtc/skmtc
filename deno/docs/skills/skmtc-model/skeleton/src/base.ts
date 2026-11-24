import { camelCase, decapitalize } from '@skmtc/core'
import { sanitizeIdentifier, toTsModelProjectionBase } from '@skmtc/lang-typescript'
import denoJson from '../deno.json' with { type: 'json' }
import { type EnrichmentSchema, toEnrichmentSchema } from './enrichments.ts'

export const MyLibBase = toTsModelProjectionBase<EnrichmentSchema>({
  id: denoJson.name,

  // SLOT(naming): the emitted binding name, derived from the ref ONLY
  // (deterministic; never operationId, never construction-dependent).
  // The engine stores the name as returned, so return a valid binding:
  // a schema named `Default` would otherwise give `export const default`.
  toIdentifierName({ ref }): string {
    return sanitizeIdentifier(decapitalize(camelCase(ref.refName)))
  },

  // SLOT(identifier-kind): 'variable' for schema values; 'type' or
  // 'interface' would make consumers import it type-only.
  toIdentifierType: () => ({ type: 'variable' }),

  // SLOT(export-path): where each model's file lives. '@/' is basePath,
  // and the path after it is always spelled with forward slashes; keep
  // the .generated.ts suffix convention.
  toExportPath({ ref, enrichments, variant }): string {
    const name = this.toIdentifierName({ ref, enrichments, variant })

    return `@/models/${name}.generated.ts`
  },

  toEnrichmentSchema
})
