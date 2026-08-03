/**
 * @module @exp/gen-effect-schema
 *
 * SKMTC model generator that renders every OpenAPI component schema as an
 * effect `Schema` validator at `@/models/<ModelName>.generated.ts`.
 */
import { emptyEnrichmentSchema, toModelEntry, type EmptyEnrichments } from '@skmtc/core'
import type { ModelEntry } from '@skmtc/core'
import { generatorId } from './src/constants.ts'
import { EffectSchema } from './src/EffectSchema.ts'

const entry: ModelEntry<EmptyEnrichments> = toModelEntry({
  id: generatorId,
  transform: ({ context, refName }) => {
    context.insertModel(EffectSchema, refName)
  },
  toEnrichmentSchema: () => emptyEnrichmentSchema
})

export default entry
export { EffectSchema }
