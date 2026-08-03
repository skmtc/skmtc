import { TsSnippet } from '@skmtc/lang-typescript'
import { applyModifiers } from './applyModifiers.ts'
import type { GenerateContextType, GeneratorKey, Modifiers, OasInteger } from '@skmtc/core'
import { TypeboxOptions } from './TypeboxOptions.ts'

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
  format?: 'int32' | 'int64'
  enums?: number[] | (number | null)[]
  options: TypeboxOptions

  constructor({ context, schema, modifiers, destinationPath, generatorKey }: TypeboxIntegerArgs) {
    super({ context, generatorKey, stackTrail: schema.stackTrail.clone() })

    this.format = schema.format
    this.enums = schema.enums
    this.modifiers = modifiers

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

    return applyModifiers(`Type.Integer(${this.options})`, this.modifiers)
  }
}
