import type { GenerateContextType, GeneratorKey, Modifiers, OasString } from '@skmtc/core'
import { TsSnippet } from '@skmtc/lang-typescript'
import { applyModifiers } from './applyModifiers.ts'

type TypeboxStringArgs = {
  context: GenerateContextType
  stringSchema: OasString
  required: boolean
  destinationPath: string
  generatorKey?: GeneratorKey
}

export class TypeboxString extends TsSnippet {
  enums: string[] | undefined
  modifiers: Modifiers

  constructor({ context, stringSchema, required, destinationPath, generatorKey }: TypeboxStringArgs) {
    super({ context, generatorKey })

    const enumValues: (string | null)[] = stringSchema.enums ?? []
    const literals = enumValues.filter((value): value is string => typeof value === 'string')

    this.enums = literals.length > 0 ? literals : undefined
    this.modifiers = {
      required,
      nullable: stringSchema.nullable || enumValues.some(value => value === null)
    }

    this.register({ imports: { '@sinclair/typebox': ['Type'] }, destinationPath })
  }

  override toString(): string {
    const content = this.enums?.length
      ? this.enums.length === 1
        ? `Type.Literal(${JSON.stringify(this.enums[0])})`
        : `Type.Union([${this.enums.map(value => `Type.Literal(${JSON.stringify(value)})`).join(', ')}])`
      : 'Type.String()'

    return applyModifiers(content, this.modifiers)
  }
}
