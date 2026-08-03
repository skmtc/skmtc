import { TsSnippet } from '@skmtc/lang-typescript'
import type { GenerateContextType, GeneratorKey, Modifiers, OasString } from '@skmtc/core'
import { applyModifiers } from './applyModifiers.ts'
import { TypeBoxOptions } from './TypeBoxOptions.ts'

type TypeBoxStringArgs = {
  context: GenerateContextType
  stringSchema: OasString
  modifiers: Modifiers
  destinationPath: string
  generatorKey: GeneratorKey
}

export class TypeBoxString extends TsSnippet {
  type = 'string' as const
  enums: string[] | (string | null)[] | undefined
  options: TypeBoxOptions
  modifiers: Modifiers

  constructor({ context, stringSchema, generatorKey, destinationPath, modifiers }: TypeBoxStringArgs) {
    super({ context, generatorKey, stackTrail: stringSchema.stackTrail.clone() })

    this.enums = stringSchema.enums
    this.modifiers = modifiers

    this.options = new TypeBoxOptions({
      context,
      entries: {
        minLength: stringSchema.minLength,
        maxLength: stringSchema.maxLength,
        format: stringSchema.format
      }
    })

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
      content = `Type.String(${this.options})`
    }

    return applyModifiers(content, this.modifiers)
  }
}
