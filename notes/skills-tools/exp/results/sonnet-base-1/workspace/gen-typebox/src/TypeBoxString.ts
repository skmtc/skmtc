import { TsSnippet } from 'jsr:@skmtc/lang-typescript@0.12.17'
import { applyModifiers } from './applyModifiers.ts'
import { toOptionsLiteral } from './toOptionsLiteral.ts'
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
  enums: string[] | (string | null)[] | undefined
  options: string
  modifiers: Modifiers

  constructor({ context, stringSchema, generatorKey, destinationPath, modifiers }: TypeBoxStringArgs) {
    super({ context, generatorKey, stackTrail: stringSchema.stackTrail.clone() })

    this.enums = stringSchema.enums
    this.options = toOptionsLiteral({
      minLength: stringSchema.minLength,
      maxLength: stringSchema.maxLength
    })
    this.modifiers = modifiers

    this.register({ imports: { '@sinclair/typebox': ['Type'] }, destinationPath })
  }

  override toString(): string {
    const { enums } = this

    let content: string

    if (enums && Array.isArray(enums)) {
      content =
        enums.length === 1
          ? `Type.Literal('${enums[0]}')`
          : `Type.Union([${enums.map(value => `Type.Literal('${value}')`).join(', ')}])`
    } else {
      content = this.options ? `Type.String(${this.options})` : 'Type.String()'
    }

    return applyModifiers(content, this.modifiers)
  }
}
