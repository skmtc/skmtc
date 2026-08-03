import { type GenerateContextType, type GeneratorKey, type Modifiers, type OasNumber } from 'jsr:@skmtc/core@0.28.3'
import { TsSnippet } from 'jsr:@skmtc/lang-typescript@0.12.17'
import { applyModifiers } from './applyModifiers.ts'

type TypeboxNumberArgs = {
  context: GenerateContextType
  modifiers: Modifiers
  schema: OasNumber
  destinationPath: string
  generatorKey: GeneratorKey
}

export class TypeboxNumber extends TsSnippet {
  type = 'number' as const
  modifiers: Modifiers
  enums?: number[] | (number | null)[]

  constructor({ context, modifiers, schema, destinationPath, generatorKey }: TypeboxNumberArgs) {
    super({ context, generatorKey, stackTrail: schema.stackTrail.clone() })

    this.modifiers = modifiers
    this.enums = schema.enums

    this.register({ imports: { '@sinclair/typebox': ['Type'] }, destinationPath })
  }

  override toString(): string {
    const { enums } = this

    if (enums && Array.isArray(enums)) {
      const content = enums.length === 1
        ? `Type.Literal(${enums[0]})`
        : `Type.Union([${enums.map(value => `Type.Literal(${value})`).join(', ')}])`
      return applyModifiers(content, this.modifiers)
    }

    return applyModifiers(`Type.Number()`, this.modifiers)
  }
}
