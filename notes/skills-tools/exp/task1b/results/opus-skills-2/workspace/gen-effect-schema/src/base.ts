import { camelCase, capitalize } from '@skmtc/core'
import {
  sanitizeIdentifier,
  toTsModelProjectionBase,
} from '@skmtc/lang-typescript'
import { join } from '@std/path'
import denoJson from '../deno.json' with { type: 'json' }
import { type EnrichmentSchema, toEnrichmentSchema } from './enrichments.ts'

export const EffectSchemaBase = toTsModelProjectionBase<EnrichmentSchema>({
  id: denoJson.name,

  // SLOT(naming): the emitted binding name, derived from refName ONLY
  // (deterministic; never operationId, never construction-dependent).
  // effect schemas read as types at the use site, so they take the
  // PascalCase of the model name: `Order`, `OrderItem`.
  toIdentifierName({ refName }): string {
    return sanitizeIdentifier(capitalize(camelCase(refName)))
  },

  // SLOT(identifier-kind): 'variable' for schema values; 'type' or
  // 'interface' would make consumers import it type-only.
  toIdentifierType: () => ({ type: 'variable' }),

  // SLOT(export-path): where each model's file lives. '@' is the
  // project-root marker; keep the .generated.ts suffix convention.
  toExportPath({ refName, enrichments, variant }): string {
    const name = this.toIdentifierName({ refName, enrichments, variant })

    return join('@', 'models', `${name}.generated.ts`)
  },

  toEnrichmentSchema,
})
