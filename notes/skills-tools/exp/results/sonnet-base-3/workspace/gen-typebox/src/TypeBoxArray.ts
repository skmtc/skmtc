import { TsSnippet } from 'jsr:@skmtc/lang-typescript@0.12.17'
import type { GenerateContextType, GeneratorKey, Modifiers, OasRef, OasSchema, RefName, TypeSystemValue } from 'jsr:@skmtc/core@0.28.3'
import { toTypeBoxValue } from './TypeBox.ts'
import { applyModifiers } from './applyModifiers.ts'

type TypeBoxArrayArgs = {
  context: GenerateContextType
  destinationPath: string
  items: OasSchema | OasRef<'schema'>
  /** The originating array schema node — for fine-grained attribution. */
  schema?: OasSchema | OasRef<'schema'>
  modifiers: Modifiers
  generatorKey: GeneratorKey
  rootRef?: RefName
}

export class TypeBoxArray extends TsSnippet {
  type = 'array' as const
  items: TypeSystemValue
  modifiers: Modifiers

  constructor(
    { context, generatorKey, destinationPath, items, modifiers, rootRef, schema }: TypeBoxArrayArgs
  ) {
    super({ context, generatorKey, stackTrail: schema?.stackTrail.clone() })

    this.modifiers = modifiers

    this.items = toTypeBoxValue({
      destinationPath,
      schema: items,
      required: true,
      context,
      rootRef
    })

    this.register({ imports: { '@sinclair/typebox': ['Type'] }, destinationPath })
  }

  override toString(): string {
    return applyModifiers(`Type.Array(${this.items})`, this.modifiers)
  }
}
