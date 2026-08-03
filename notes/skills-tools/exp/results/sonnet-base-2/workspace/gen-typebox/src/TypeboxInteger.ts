import { TsSnippet } from 'jsr:@skmtc/lang-typescript@0.12.17'
import { applyModifiers } from './applyModifiers.ts'
import type { GenerateContextType, GeneratorKey, Modifiers, OasInteger } from 'jsr:@skmtc/core@0.28.3'

type TypeboxIntegerArgs = {
  context: GenerateContextType
  schema: OasInteger
  modifiers: Modifiers
  destinationPath: string
  generatorKey: GeneratorKey
}

export class TypeboxInteger extends TsSnippet {
  type = 'integer' as const
  modifiers: Modifiers
  enums?: number[] | (number | null)[]

  constructor({ context, schema, modifiers, destinationPath, generatorKey }: TypeboxIntegerArgs) {
    super({ context, generatorKey, stackTrail: schema.stackTrail.clone() })

    this.enums = schema.enums
    this.modifiers = modifiers

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

    return applyModifiers(`Type.Integer()`, this.modifiers)
  }
}
