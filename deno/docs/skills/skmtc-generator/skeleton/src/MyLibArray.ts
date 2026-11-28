import { TsSnippet } from '@skmtc/lang-typescript'
import type {
  GenerateContextType,
  GeneratorKey,
  Modifiers,
  OasRef,
  OasSchema,
  TypeSystemValue,
} from '@skmtc/core'
import { toMyLibValue } from './MyLib.ts'
import { applyModifiers } from './modifiers.ts'
import { LIB, LIB_MODULE } from './lib.ts'

type MyLibArrayArgs = {
  context: GenerateContextType
  destinationPath: string
  items: OasSchema | OasRef<'schema'>
  /** The originating array schema node — for fine-grained attribution. */
  schema?: OasSchema | OasRef<'schema'>
  modifiers: Modifiers
  generatorKey: GeneratorKey
}

export class MyLibArray extends TsSnippet {
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
      schema,
    }: MyLibArrayArgs,
  ) {
    super({ context, generatorKey, stackTrail: schema?.stackTrail.clone() })

    this.modifiers = modifiers

    // The items value is built by recursing through the router — a
    // snippet, never a string. This is what keeps nested refs cached.
    this.items = toMyLibValue({
      destinationPath,
      schema: items,
      required: true,
      context,
    })

    this.register({ imports: { [LIB_MODULE]: [LIB] }, destinationPath })
  }

  override toString(): string {
    // SLOT(array)
    return applyModifiers(`${LIB}.array(${this.items})`, this.modifiers)
  }
}
