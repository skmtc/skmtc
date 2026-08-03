import { TsSnippet, List } from '@skmtc/lang-typescript'
import type { GenerateContextType, GeneratorKey, OasString } from '@skmtc/core'
import { applyNullable } from './applyNullable.ts'

type ConstructorArgs = {
  context: GenerateContextType
  stringSchema: OasString
  destinationPath: string
  generatorKey?: GeneratorKey
}

export class TypeboxString extends TsSnippet {
  enums: (string | null)[] | undefined
  nullable: boolean | undefined

  constructor({ context, stringSchema, destinationPath, generatorKey }: ConstructorArgs) {
    super({ context, generatorKey, stackTrail: stringSchema.stackTrail.clone() })

    this.enums = stringSchema.enums
    this.nullable = stringSchema.nullable

    this.register({ imports: { '@sinclair/typebox': ['Type'] }, destinationPath })
  }

  override toString(): string {
    if (this.enums?.length) {
      const literals: string[] = this.enums
        .filter((entry): entry is string => entry !== null)
        .map(entry => `Type.Literal(${JSON.stringify(entry)})`)

      if (this.enums.includes(null) || this.nullable) {
        literals.push('Type.Null()')
      }

      return literals.length === 1 ? literals[0] : `Type.Union(${List.toArray(literals)})`
    }

    return applyNullable('Type.String()', this.nullable)
  }
}
