import { TsSnippet } from '@skmtc/lang-typescript'
import type { GenerateContextType, GeneratorKey, Modifiers, OasBoolean } from '@skmtc/core'
import { applyModifiers } from './applyModifiers.ts'

type TypeBoxBooleanArgs = {
  context: GenerateContextType
  modifiers: Modifiers
  schema: OasBoolean
  destinationPath: string
  generatorKey: GeneratorKey
}

export class TypeBoxBoolean extends TsSnippet {
  type = 'boolean' as const
  modifiers: Modifiers
  enums?: boolean[] | (boolean | null)[]

  constructor({ context, modifiers, schema, destinationPath, generatorKey }: TypeBoxBooleanArgs) {
    super({ context, generatorKey, stackTrail: schema.stackTrail.clone() })

    this.modifiers = modifiers
    this.enums = schema.enums

    this.register({ imports: { '@sinclair/typebox': ['Type'] }, destinationPath })
  }

  override toString(): string {
    const { enums } = this

    // A multi-value boolean enum carries no information beyond Type.Boolean().
    const content = enums && Array.isArray(enums) && enums.length === 1
      ? `Type.Literal(${enums[0]})`
      : `Type.Boolean()`

    return applyModifiers(content, this.modifiers)
  }
}
