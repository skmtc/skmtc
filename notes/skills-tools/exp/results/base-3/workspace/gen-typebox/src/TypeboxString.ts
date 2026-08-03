import { TsSnippet } from '@skmtc/lang-typescript'
import type { GenerateContextType, GeneratorKey, Modifiers, OasString } from '@skmtc/core'
import { applyModifiers } from './applyModifiers.ts'
import { typeboxImports } from './imports.ts'

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
  minLength: number | undefined
  maxLength: number | undefined
  modifiers: Modifiers

  constructor({ context, stringSchema, generatorKey, destinationPath, modifiers }: TypeboxStringArgs) {
    super({ context, generatorKey, stackTrail: stringSchema.stackTrail.clone() })

    this.enums = stringSchema.enums
    this.format = stringSchema.format
    this.minLength = stringSchema.minLength
    this.maxLength = stringSchema.maxLength
    this.modifiers = modifiers

    this.register({ imports: typeboxImports, destinationPath })
  }

  override toString(): string {
    const { enums } = this

    let content: string

    if (enums && Array.isArray(enums)) {
      const literals = enums.map(value =>
        value === null ? 'Type.Null()' : `Type.Literal('${value}')`
      )

      content = literals.length === 1 ? literals[0] : `Type.Union([${literals.join(', ')}])`
    } else {
      const options: string[] = []

      if (this.minLength !== undefined) options.push(`minLength: ${this.minLength}`)
      if (this.maxLength !== undefined) options.push(`maxLength: ${this.maxLength}`)

      content = options.length ? `Type.String({ ${options.join(', ')} })` : 'Type.String()'
    }

    return applyModifiers(content, this.modifiers)
  }
}
