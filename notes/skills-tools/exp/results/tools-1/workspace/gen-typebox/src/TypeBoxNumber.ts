import type { GenerateContextType, GeneratorKey, Modifiers, OasNumber } from '@skmtc/core'
import { TsSnippet } from '@skmtc/lang-typescript'
import { applyModifiers } from './applyModifiers.ts'
import { TypeBoxOptions } from './TypeBoxOptions.ts'

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
  options: TypeBoxOptions

  constructor({ context, modifiers, schema, destinationPath, generatorKey }: TypeBoxNumberArgs) {
    super({ context, generatorKey, stackTrail: schema.stackTrail.clone() })

    this.modifiers = modifiers
    this.enums = schema.enums

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
      content = `Type.Number(${this.options})`
    }

    return applyModifiers(content, this.modifiers)
  }
}
