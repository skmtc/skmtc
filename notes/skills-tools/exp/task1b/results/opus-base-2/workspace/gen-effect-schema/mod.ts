/**
 * @module @exp/gen-effect-schema
 *
 * An SKMTC model generator that renders every component schema as an
 * effect `Schema` (`import { Schema } from 'effect'`) validator — one
 * `export const <Name> = Schema…` per model, in
 * `@/models/<Name>.generated.ts`.
 */

export { EffectSchemaBase } from './src/base.ts'
export { EffectSchemaProjection } from './src/EffectSchemaProjection.ts'
export { toEffectValue } from './src/Effect.ts'
export { EffectArray } from './src/EffectArray.ts'
export { EffectObject } from './src/EffectObject.ts'
export { EffectRef } from './src/EffectRef.ts'
export { EffectUnion } from './src/EffectUnion.ts'
export {
  EffectBoolean,
  EffectInteger,
  EffectNumber,
  EffectString,
  EffectUnknown,
  EffectVoid
} from './src/EffectScalars.ts'
export { effectSchemaEntry as default } from './src/mod.ts'
