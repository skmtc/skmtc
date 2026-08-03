import { TsSnippet } from '@skmtc/lang-typescript'
import type { GenerateContextType, GeneratorKey, Modifiers, OasBoolean } from '@skmtc/core'
import { applyModifiers } from './applyModifiers.ts'

type TypeboxBooleanArgs = {
  context: GenerateContextType
  modifiers: Modifiers
  schema: OasBoolean
  destinationPath: string
  generatorKey: GeneratorKey
}

export class TypeboxBoolean extends TsSnippet {
  type = 'boolean' as const
  modifiers: Modifiers
  enums?: boolean[] | (boolean | null)[]

  constructor({ context, modifiers, schema, destinationPath, generatorKey }: TypeboxBooleanArgs) {
    super({ context, generatorKey, stackTrail: schema.stackTrail.clone() })

    this.modifiers = modifiers
    this.enums = schema.enums

    this.register({ imports: { '@sinclair/typebox': ['Type'] }, destinationPath })
  }

  override toString(): string {
    const { enums } = this

    const content =
      enums && Array.isArray(enums) && enums.length === 1
        ? enums[0] === null
          ? 'Type.Null()'
          : `Type.Literal(${enums[0]})`
        : `Type.Boolean()`

    return applyModifiers(content, this.modifiers)
  }
}
