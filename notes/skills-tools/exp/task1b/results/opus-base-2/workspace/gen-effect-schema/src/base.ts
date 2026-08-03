import { camelCase } from '@skmtc/core'
import { toTsModelProjectionBase } from '@skmtc/lang-typescript'
import { join } from '@std/path'
import { toEnrichmentSchema, type EnrichmentSchema } from './enrichments.ts'
import denoJson from '../deno.json' with { type: 'json' }

/**
 * The projection base every effect Schema model is built on: it fixes the
 * generator id, the PascalCase constant name, and the one-file-per-model
 * export path.
 */
export const EffectSchemaBase = toTsModelProjectionBase<EnrichmentSchema>({
  id: denoJson.name,

  /**
   * An effect Schema constant doubles as the name of the type it decodes to,
   * so models are PascalCase — `export const Order = …`.
   */
  toIdentifierName({ refName }): string {
    return camelCase(refName, { upperFirst: true })
  },

  toIdentifierType: () => ({ type: 'variable' }),

  toExportPath({ refName, enrichments, variant }): string {
    const name = this.toIdentifierName({ refName, enrichments, variant })

    return join('@', 'models', `${name}.generated.ts`)
  },

  toEnrichmentSchema
})
