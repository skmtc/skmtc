import { TsSnippet } from '@skmtc/lang-typescript'
import type {
  GenerateContextType,
  GeneratorKey,
  Modifiers,
  OasRef,
  OasSchema,
  RefName,
  StackTrail,
  TypeSystemValue
} from '@skmtc/core'
import { toEffectValue } from './Effect.ts'
import { applyModifiers } from './applyModifiers.ts'
import { EFFECT_MODULE, SCHEMA } from './constants.ts'

type EffectArrayArgs = {
  context: GenerateContextType
  destinationPath: string
  items: OasSchema | OasRef<'schema'>
  modifiers: Modifiers
  generatorKey: GeneratorKey
  rootRef?: RefName
  stackTrail?: StackTrail
}

/** `Schema.Array(items)`. */
export class EffectArray extends TsSnippet {
  type = 'array' as const
  items: TypeSystemValue
  modifiers: Modifiers

  constructor({
    context,
    destinationPath,
    items,
    modifiers,
    generatorKey,
    rootRef,
    stackTrail
  }: EffectArrayArgs) {
    super({ context, generatorKey, stackTrail })

    this.modifiers = modifiers

    this.items = toEffectValue({
      context,
      destinationPath,
      schema: items,
      required: true,
      rootRef
    })

    this.register({ imports: { [EFFECT_MODULE]: [SCHEMA] }, destinationPath })
  }

  override toString(): string {
    return applyModifiers(`${SCHEMA}.Array(${this.items})`, this.modifiers)
  }
}
