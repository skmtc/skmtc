import { TsSnippet } from 'jsr:@skmtc/lang-typescript@0.12.17'
import { applyModifiers } from './applyModifiers.ts'
import type { GenerateContextType, GeneratorKey, Modifiers, OasInteger } from 'jsr:@skmtc/core@0.28.3'

type TypeBoxIntegerArgs = {
  context: GenerateContextType
  schema: OasInteger
  modifiers: Modifiers
  destinationPath: string
  generatorKey: GeneratorKey
}

export class TypeBoxInteger extends TsSnippet {
  type = 'integer' as const
  modifiers: Modifiers
  format?: 'int32' | 'int64'
  enums?: number[] | (number | null)[]
  options: string[]

  constructor(
    { context, schema, modifiers, destinationPath, generatorKey }: TypeBoxIntegerArgs
  ) {
    super({ context, generatorKey, stackTrail: schema.stackTrail.clone() })

    this.format = schema.format
    this.enums = schema.enums
    this.modifiers = modifiers
    this.options = []

    if (schema.minimum !== undefined) {
      this.options.push(
        schema.exclusiveMinimum ? `exclusiveMinimum: ${schema.minimum}` : `minimum: ${schema.minimum}`
      )
    }

    if (schema.maximum !== undefined) {
      this.options.push(
        schema.exclusiveMaximum ? `exclusiveMaximum: ${schema.maximum}` : `maximum: ${schema.maximum}`
      )
    }

    if (schema.multipleOf !== undefined) {
      this.options.push(`multipleOf: ${schema.multipleOf}`)
    }

    this.register({ imports: { '@sinclair/typebox': ['Type'] }, destinationPath })
  }

  override toString(): string {
    const { enums } = this

    if (enums && Array.isArray(enums)) {
      const content = enums.length === 1
        ? `Type.Literal(${enums[0]})`
        : `Type.Union([${enums.map((e) => `Type.Literal(${e})`).join(', ')}])`

      return applyModifiers(content, this.modifiers)
    }

    const content = `Type.Integer(${this.options.length ? `{ ${this.options.join(', ')} }` : ''})`

    return applyModifiers(content, this.modifiers)
  }
}
