import { TsSnippet } from '@skmtc/lang-typescript'
import type { GenerateContextType, GeneratorKey, Modifiers, OasInteger } from '@skmtc/core'
import { applyModifiers } from './applyModifiers.ts'

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
  enums?: number[] | (number | null)[]

  constructor({ context, schema, modifiers, destinationPath, generatorKey }: TypeboxIntegerArgs) {
    super({ context, generatorKey, stackTrail: schema.stackTrail.clone() })

    this.modifiers = modifiers
    this.enums = schema.enums

    this.register({ imports: { '@sinclair/typebox': ['Type'] }, destinationPath })
  }

  override toString(): string {
    const { enums } = this

    let content: string

    if (enums && Array.isArray(enums)) {
      const literals = enums.map(entry => (entry === null ? 'Type.Null()' : `Type.Literal(${entry})`))

      content = literals.length === 1 ? literals[0] : `Type.Union([${literals.join(', ')}])`
    } else {
      content = `Type.Integer()`
    }

    return applyModifiers(content, this.modifiers)
  }
}
