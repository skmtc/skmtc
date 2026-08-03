import type { GenerateContextType, GeneratorKey, Modifiers, OasUnion, Stringable } from '@skmtc/core'
import { List, TsSnippet } from '@skmtc/lang-typescript'
import { applyModifiers } from './applyModifiers.ts'
import { toTypeboxValue } from './toTypeboxValue.ts'

type TypeboxUnionArgs = {
  context: GenerateContextType
  unionSchema: OasUnion
  required: boolean
  destinationPath: string
  generatorKey?: GeneratorKey
}

export class TypeboxUnion extends TsSnippet {
  members: Stringable
  modifiers: Modifiers

  constructor({ context, unionSchema, required, destinationPath, generatorKey }: TypeboxUnionArgs) {
    super({ context, generatorKey })

    this.modifiers = { required, nullable: unionSchema.nullable }

    this.members = List.toArray(
      unionSchema.members.map(member =>
        toTypeboxValue({
          schema: member,
          required: true,
          destinationPath,
          context,
          generatorKey
        })
      )
    )

    this.register({ imports: { '@sinclair/typebox': ['Type'] }, destinationPath })
  }

  override toString(): string {
    return applyModifiers(`Type.Union(${this.members})`, this.modifiers)
  }
}
