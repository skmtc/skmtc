import { TsSnippet } from '@skmtc/lang-typescript'
import { applyModifiers } from './applyModifiers.ts'
import type { GenerateContextType, GeneratorKey, Modifiers, OasString } from '@skmtc/core'
import { TypeboxOptions } from './TypeboxOptions.ts'

type TypeboxStringArgs = {
  context: GenerateContextType
  stringSchema: OasString
  modifiers: Modifiers
  destinationPath: string
  generatorKey: GeneratorKey
}

export class TypeboxString extends TsSnippet {
  type = 'string' as const
  format: string | undefined
  enums: string[] | (string | null)[] | undefined
  options: TypeboxOptions
  modifiers: Modifiers
  constructor({ context, stringSchema, generatorKey, destinationPath, modifiers }: TypeboxStringArgs) {
    super({ context, generatorKey, stackTrail: stringSchema.stackTrail.clone() })

    this.enums = stringSchema.enums
    this.format = stringSchema.format
    this.options = new TypeboxOptions({ context })
    this.options.add('minLength', stringSchema.minLength)
    this.options.add('maxLength', stringSchema.maxLength)

    this.modifiers = modifiers

    this.register({ imports: { '@sinclair/typebox': ['Type'] }, destinationPath })
  }

  override toString(): string {
    const { enums } = this

    let content: string
    if (enums && Array.isArray(enums)) {
      const literals = enums.map(str => (str === null ? 'Type.Null()' : `Type.Literal('${str}')`))

      content = literals.length === 1 ? literals[0] : `Type.Union([${literals.join(', ')}])`
    } else {
      content = `Type.String(${this.options})`
    }

    return applyModifiers(content, this.modifiers)
  }
}
