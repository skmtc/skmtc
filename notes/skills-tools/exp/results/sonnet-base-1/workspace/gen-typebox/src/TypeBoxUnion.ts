import { TsSnippet } from 'jsr:@skmtc/lang-typescript@0.12.17'
import type { GenerateContextType, GeneratorKey, Modifiers, OasRef, OasSchema, RefName, TypeSystemValue } from 'jsr:@skmtc/core@0.28.3'
import { toTypeBoxValue } from './TypeBox.ts'
import { applyModifiers } from './applyModifiers.ts'

type TypeBoxUnionArgs = {
  context: GenerateContextType
  destinationPath: string
  members: (OasSchema | OasRef<'schema'>)[]
  /** The originating union schema node — for fine-grained attribution. */
  schema?: OasSchema | OasRef<'schema'>
  modifiers: Modifiers
  generatorKey: GeneratorKey
  rootRef?: RefName
}

export class TypeBoxUnion extends TsSnippet {
  type = 'union' as const
  members: TypeSystemValue[]
  modifiers: Modifiers

  constructor({ context, generatorKey, destinationPath, members, modifiers, rootRef, schema }: TypeBoxUnionArgs) {
    super({ context, generatorKey, stackTrail: schema?.stackTrail.clone() })

    this.members = members.map(member => {
      return toTypeBoxValue({
        destinationPath,
        schema: member,
        required: true,
        context,
        rootRef
      })
    })

    this.modifiers = modifiers

    this.register({ imports: { '@sinclair/typebox': ['Type'] }, destinationPath })
  }

  override toString(): string {
    const members = this.members.map(member => `${member}`).join(', ')

    return applyModifiers(`Type.Union([${members}])`, this.modifiers)
  }
}
