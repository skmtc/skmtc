import { TsSnippet } from '@skmtc/lang-typescript'
import type { GenerateContextType, GeneratorKey, Modifiers, OasNumber } from '@skmtc/core'
import { applyModifiers } from './applyModifiers.ts'

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

  constructor({ context, modifiers, schema, destinationPath, generatorKey }: TypeboxNumberArgs) {
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
      content = `Type.Number()`
    }

    return applyModifiers(content, this.modifiers)
  }
}
