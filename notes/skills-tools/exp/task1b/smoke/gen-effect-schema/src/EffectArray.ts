import { TsSnippet } from '@skmtc/lang-typescript'
import type {
  GenerateContextType,
  GeneratorKey,
  Modifiers,
  OasRef,
  OasSchema,
  RefName,
  TypeSystemValue,
} from '@skmtc/core'
import { toEffectValue } from './Effect.ts'
import { applyModifiers } from './modifiers.ts'
import { LIB, LIB_MODULE } from './lib.ts'

type EffectArrayArgs = {
  context: GenerateContextType
  destinationPath: string
  items: OasSchema | OasRef<'schema'>
  /** The originating array schema node — for fine-grained attribution. */
  schema?: OasSchema | OasRef<'schema'>
  modifiers: Modifiers
  generatorKey: GeneratorKey
  rootRef?: RefName
}

export class EffectArray extends TsSnippet {
  type = 'array' as const
  items: TypeSystemValue
  modifiers: Modifiers

  constructor(
    {
      context,
      generatorKey,
      destinationPath,
      items,
      modifiers,
      rootRef,
      schema,
    }: EffectArrayArgs,
  ) {
    super({ context, generatorKey, stackTrail: schema?.stackTrail.clone() })

    this.modifiers = modifiers

    // The items value is built by recursing through the router — a
    // snippet, never a string. This is what keeps nested refs cached.
    this.items = toEffectValue({
      destinationPath,
      schema: items,
      required: true,
      context,
      rootRef,
    })

    this.register({ imports: { [LIB_MODULE]: [LIB] }, destinationPath })
  }

  override toString(): string {
    // SLOT(array)
    return applyModifiers(`${LIB}.Array(${this.items})`, this.modifiers)
  }
}
