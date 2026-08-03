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
import { toEffectSchemaValue } from './EffectSchema.ts'
import { applyModifiers } from './modifiers.ts'
import { LIB, LIB_MODULE } from './lib.ts'

type EffectSchemaArrayArgs = {
  context: GenerateContextType
  destinationPath: string
  items: OasSchema | OasRef<'schema'>
  /** The originating array schema node — for fine-grained attribution. */
  schema?: OasSchema | OasRef<'schema'>
  modifiers: Modifiers
  generatorKey: GeneratorKey
  rootRef?: RefName
}

export class EffectSchemaArray extends TsSnippet {
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
    }: EffectSchemaArrayArgs,
  ) {
    super({ context, generatorKey, stackTrail: schema?.stackTrail.clone() })

    this.modifiers = modifiers

    // The items value is built by recursing through the router — a
    // snippet, never a string. This is what keeps nested refs cached.
    this.items = toEffectSchemaValue({
      destinationPath,
      schema: items,
      required: true,
      context,
      rootRef,
    })

    this.register({ imports: { [LIB_MODULE]: [LIB] }, destinationPath })
  }

  override toString(): string {
    // SLOT(array): effect's Array yields a ReadonlyArray schema.
    return applyModifiers(`${LIB}.Array(${this.items})`, this.modifiers)
  }
}
