import { TsSnippet } from '@skmtc/lang-typescript'
import type { GenerateContextType, GeneratorKey, Modifiers, OasString } from '@skmtc/core'
import { applyModifiers } from './applyModifiers.ts'
import { TypeBoxOptions } from './TypeBoxOptions.ts'

type TypeBoxStringArgs = {
  context: GenerateContextType
  stringSchema: OasString
  modifiers: Modifiers
  destinationPath: string
  generatorKey: GeneratorKey
}

export class TypeBoxString extends TsSnippet {
  type = 'string' as const
  format: string | undefined
  enums: string[] | (string | null)[] | undefined
  options: TypeBoxOptions
  modifiers: Modifiers

  constructor({ context, stringSchema, generatorKey, destinationPath, modifiers }: TypeBoxStringArgs) {
    super({ context, generatorKey, stackTrail: stringSchema.stackTrail.clone() })

    this.enums = stringSchema.enums
    this.format = stringSchema.format

    this.options = new TypeBoxOptions({ context })
    this.options.add('minLength', stringSchema.minLength)
    this.options.add('maxLength', stringSchema.maxLength)

    this.modifiers = modifiers

    this.register({ imports: { '@sinclair/typebox': ['Type'] }, destinationPath })
  }

  override toString(): string {
    const { enums } = this

    let content: string
    if (enums && Array.isArray(enums)) {
      const literals = enums.map(value => (value === null ? 'Type.Null()' : `Type.Literal("${value}")`))

      content = literals.length === 1 ? literals[0] : `Type.Union([${literals.join(', ')}])`
    } else {
      content = `Type.String(${this.options})`
    }

    return applyModifiers(content, this.modifiers)
  }
}
