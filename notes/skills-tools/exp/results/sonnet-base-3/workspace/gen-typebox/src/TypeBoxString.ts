import { TsSnippet } from 'jsr:@skmtc/lang-typescript@0.12.17'
import { applyModifiers } from './applyModifiers.ts'
import type { GenerateContextType, GeneratorKey, Modifiers, OasString } from 'jsr:@skmtc/core@0.28.3'

type TypeBoxStringArgs = {
  context: GenerateContextType
  stringSchema: OasString
  modifiers: Modifiers
  destinationPath: string
  generatorKey: GeneratorKey
}

export class TypeBoxString extends TsSnippet {
  type = 'string' as const
  format: string | undefined
  enums: string[] | (string | null)[] | undefined
  minLength: number | undefined
  maxLength: number | undefined
  modifiers: Modifiers

  constructor(
    { context, stringSchema, generatorKey, destinationPath, modifiers }: TypeBoxStringArgs
  ) {
    super({ context, generatorKey, stackTrail: stringSchema.stackTrail.clone() })

    this.enums = stringSchema.enums
    this.format = stringSchema.format
    this.minLength = stringSchema.minLength
    this.maxLength = stringSchema.maxLength
    this.modifiers = modifiers

    this.register({ imports: { '@sinclair/typebox': ['Type'] }, destinationPath })
  }

  override toString(): string {
    const { enums } = this

    if (enums && Array.isArray(enums)) {
      const content = enums.length === 1
        ? `Type.Literal(${JSON.stringify(enums[0])})`
        : `Type.Union([${enums.map((str) => `Type.Literal(${JSON.stringify(str)})`).join(', ')}])`

      return applyModifiers(content, this.modifiers)
    }

    const options: string[] = []
    if (this.minLength !== undefined) options.push(`minLength: ${this.minLength}`)
    if (this.maxLength !== undefined) options.push(`maxLength: ${this.maxLength}`)

    const content = `Type.String(${options.length ? `{ ${options.join(', ')} }` : ''})`

    return applyModifiers(content, this.modifiers)
  }
}
