import { TsSnippet, List } from '@skmtc/lang-typescript'
import type { GenerateContextType, GeneratorKey, OasUnion, Stringable } from '@skmtc/core'
import { toTypeboxValue } from './toTypeboxValue.ts'

type ConstructorArgs = {
  context: GenerateContextType
  unionSchema: OasUnion
  destinationPath: string
  generatorKey?: GeneratorKey
}

export class TypeboxUnion extends TsSnippet {
  members: Stringable[]
  nullable: boolean | undefined

  constructor({ context, unionSchema, destinationPath, generatorKey }: ConstructorArgs) {
    super({ context, generatorKey, stackTrail: unionSchema.stackTrail.clone() })

    this.nullable = unionSchema.nullable
    this.members = unionSchema.members.map(member =>
      toTypeboxValue({ schema: member, destinationPath, context, generatorKey })
    )

    this.register({ imports: { '@sinclair/typebox': ['Type'] }, destinationPath })
  }

  override toString(): string {
    const members: Stringable[] = this.nullable ? [...this.members, 'Type.Null()'] : this.members

    return `Type.Union(${List.toArray(members)})`
  }
}
