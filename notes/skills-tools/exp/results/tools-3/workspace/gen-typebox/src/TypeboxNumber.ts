import type { GenerateContextType, GeneratorKey, Modifiers, OasNumber } from '@skmtc/core'
import { TsSnippet } from '@skmtc/lang-typescript'
import { applyModifiers } from './applyModifiers.ts'
import { TypeboxOptions } from './TypeboxOptions.ts'

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
  options: TypeboxOptions

  constructor({ context, modifiers, schema, destinationPath, generatorKey }: TypeboxNumberArgs) {
    super({ context, generatorKey, stackTrail: schema.stackTrail.clone() })

    this.modifiers = modifiers
    this.enums = schema.enums
    this.options = new TypeboxOptions({ context })
    this.options.add(schema.exclusiveMinimum ? 'exclusiveMinimum' : 'minimum', schema.minimum)
    this.options.add(schema.exclusiveMaximum ? 'exclusiveMaximum' : 'maximum', schema.maximum)
    this.options.add('multipleOf', schema.multipleOf)

    this.register({ imports: { '@sinclair/typebox': ['Type'] }, destinationPath })
  }

  override toString(): string {
    const { enums } = this

    if (enums && Array.isArray(enums)) {
      const literals = enums.map(value => (value === null ? 'Type.Null()' : `Type.Literal(${value})`))

      const content = literals.length === 1 ? literals[0] : `Type.Union([${literals.join(', ')}])`

      return applyModifiers(content, this.modifiers)
    }

    return applyModifiers(`Type.Number(${this.options})`, this.modifiers)
  }
}
