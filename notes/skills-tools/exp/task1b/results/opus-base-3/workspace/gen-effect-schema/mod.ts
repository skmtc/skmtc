/**
 * @module @exp/gen-effect-schema
 *
 * SKMTC model generator emitting effect `Schema` validators — one
 * `export const <Model> = Schema.…` per OpenAPI component schema, each in
 * its own `@/models/<Model>.generated.ts` file.
 */
import { toModelEntry, emptyEnrichmentSchema } from '@skmtc/core'
import type { EmptyEnrichments, ModelEntry } from '@skmtc/core'
import { generatorId } from './src/constants.ts'
import { EffectSchemaModel } from './src/EffectSchemaModel.ts'

const entry: ModelEntry<EmptyEnrichments> = toModelEntry({
  id: generatorId,
  transform: ({ context, refName }) => {
    context.insertModel(EffectSchemaModel, refName)
  },
  toEnrichmentSchema: () => emptyEnrichmentSchema
})

export default entry

export { EffectSchemaModel }
