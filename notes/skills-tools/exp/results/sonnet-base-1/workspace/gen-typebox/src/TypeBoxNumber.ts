import { type GenerateContextType, type GeneratorKey, type Modifiers, type OasNumber } from 'jsr:@skmtc/core@0.28.3'
import { TsSnippet } from 'jsr:@skmtc/lang-typescript@0.12.17'
import { applyModifiers } from './applyModifiers.ts'
import { toOptionsLiteral } from './toOptionsLiteral.ts'

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
  options: string

  constructor({ context, modifiers, schema, destinationPath, generatorKey }: TypeBoxNumberArgs) {
    super({ context, generatorKey, stackTrail: schema.stackTrail.clone() })

    this.modifiers = modifiers
    this.enums = schema.enums

    // OpenAPI 3.0's exclusiveMinimum/exclusiveMaximum are boolean modifiers on
    // minimum/maximum; TypeBox (JSON Schema draft-07+ style) treats them as
    // the numeric bound itself.
    this.options = toOptionsLiteral({
      minimum: schema.exclusiveMinimum ? undefined : schema.minimum,
      exclusiveMinimum: schema.exclusiveMinimum ? schema.minimum : undefined,
      maximum: schema.exclusiveMaximum ? undefined : schema.maximum,
      exclusiveMaximum: schema.exclusiveMaximum ? schema.maximum : undefined,
      multipleOf: schema.multipleOf
    })

    this.register({ imports: { '@sinclair/typebox': ['Type'] }, destinationPath })
  }

  override toString(): string {
    const { enums } = this

    if (enums && Array.isArray(enums)) {
      const content =
        enums.length === 1
          ? `Type.Literal(${enums[0]})`
          : `Type.Union([${enums.map(value => `Type.Literal(${value})`).join(', ')}])`

      return applyModifiers(content, this.modifiers)
    }

    const content = this.options ? `Type.Number(${this.options})` : 'Type.Number()'

    return applyModifiers(content, this.modifiers)
  }
}
