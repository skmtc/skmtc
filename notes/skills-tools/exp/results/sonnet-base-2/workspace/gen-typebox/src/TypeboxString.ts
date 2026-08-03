import { TsSnippet } from 'jsr:@skmtc/lang-typescript@0.12.17'
import { applyModifiers } from './applyModifiers.ts'
import type { GenerateContextType, GeneratorKey, Modifiers, OasString } from 'jsr:@skmtc/core@0.28.3'

type TypeboxStringArgs = {
  context: GenerateContextType
  stringSchema: OasString
  modifiers: Modifiers
  destinationPath: string
  generatorKey: GeneratorKey
}

export class TypeboxString extends TsSnippet {
  type = 'string' as const
  enums: string[] | (string | null)[] | undefined
  modifiers: Modifiers

  constructor({ context, stringSchema, generatorKey, destinationPath, modifiers }: TypeboxStringArgs) {
    super({ context, generatorKey, stackTrail: stringSchema.stackTrail.clone() })

    this.enums = stringSchema.enums
    this.modifiers = modifiers

    this.register({ imports: { '@sinclair/typebox': ['Type'] }, destinationPath })
  }

  override toString(): string {
    const { enums } = this

    let content: string
    if (enums && Array.isArray(enums)) {
      content = enums.length === 1
        ? `Type.Literal(${JSON.stringify(enums[0])})`
        : `Type.Union([${enums.map(value => `Type.Literal(${JSON.stringify(value)})`).join(', ')}])`
    } else {
      content = `Type.String()`
    }

    return applyModifiers(content, this.modifiers)
  }
}
