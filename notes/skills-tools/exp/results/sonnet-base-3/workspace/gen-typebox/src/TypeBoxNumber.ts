import { type GenerateContextType, type GeneratorKey, type Modifiers, type OasNumber } from 'jsr:@skmtc/core@0.28.3'
import { TsSnippet } from 'jsr:@skmtc/lang-typescript@0.12.17'
import { applyModifiers } from './applyModifiers.ts'

type TypeBoxNumberArgs = {
  context: GenerateContextType
  modifiers: Modifiers
  schema: OasNumber
  destinationPath: string
  generatorKey: GeneratorKey
}

export class TypeBoxNumber extends TsSnippet {
  type = 'number' as const
  modifiers: Modifiers
  enums?: number[] | (number | null)[]
  options: string[]

  constructor(
    { context, modifiers, schema, destinationPath, generatorKey }: TypeBoxNumberArgs
  ) {
    super({ context, generatorKey, stackTrail: schema.stackTrail.clone() })

    this.modifiers = modifiers
    this.enums = schema.enums
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

    const content = `Type.Number(${this.options.length ? `{ ${this.options.join(', ')} }` : ''})`

    return applyModifiers(content, this.modifiers)
  }
}
