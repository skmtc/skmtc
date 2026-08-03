import { TsSnippet } from '@skmtc/lang-typescript'
import type { GenerateContextType, GeneratorKey, Modifiers, OasInteger } from '@skmtc/core'
import { applyModifiers } from './applyModifiers.ts'
import { TypeBoxOptions } from './TypeBoxOptions.ts'

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
  options: TypeBoxOptions

  constructor({ context, schema, modifiers, destinationPath, generatorKey }: TypeBoxIntegerArgs) {
    super({ context, generatorKey, stackTrail: schema.stackTrail.clone() })

    this.format = schema.format
    this.enums = schema.enums
    this.modifiers = modifiers

    this.options = new TypeBoxOptions({ context })
    this.options.add(schema.exclusiveMinimum ? 'exclusiveMinimum' : 'minimum', schema.minimum)
    this.options.add(schema.exclusiveMaximum ? 'exclusiveMaximum' : 'maximum', schema.maximum)
    this.options.add('multipleOf', schema.multipleOf)

    this.register({ imports: { '@sinclair/typebox': ['Type'] }, destinationPath })
  }

  override toString(): string {
    const { enums } = this

    let content: string

    if (enums && Array.isArray(enums)) {
      const literals = enums.map(value => (value === null ? 'Type.Null()' : `Type.Literal(${value})`))

      content = literals.length === 1 ? literals[0] : `Type.Union([${literals.join(', ')}])`
    } else {
      content = `Type.Integer(${this.options})`
    }

    return applyModifiers(content, this.modifiers)
  }
}
