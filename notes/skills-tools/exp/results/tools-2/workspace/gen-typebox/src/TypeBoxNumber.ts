import { TsSnippet } from '@skmtc/lang-typescript'
import type { GenerateContextType, GeneratorKey, Modifiers, OasNumber } from '@skmtc/core'
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

    this.options = new TypeBoxOptions({
      context,
      entries: {
        [schema.exclusiveMinimum ? 'exclusiveMinimum' : 'minimum']: schema.minimum,
        [schema.exclusiveMaximum ? 'exclusiveMaximum' : 'maximum']: schema.maximum,
        multipleOf: schema.multipleOf
      }
    })

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

    return applyModifiers(`Type.Number(${this.options})`, this.modifiers)
  }
}
