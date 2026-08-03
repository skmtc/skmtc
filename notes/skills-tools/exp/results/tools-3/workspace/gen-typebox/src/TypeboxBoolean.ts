import { applyModifiers } from './applyModifiers.ts'
import type { GenerateContextType, GeneratorKey, Modifiers, OasBoolean } from '@skmtc/core'
import { TsSnippet } from '@skmtc/lang-typescript'

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

    if (enums && Array.isArray(enums)) {
      // A single-value enum narrows to a literal; `enum: [true, false]`
      // carries no extra information vs an unconstrained boolean.
      const content = enums.length === 1 ? `Type.Literal(${enums[0]})` : `Type.Boolean()`

      return applyModifiers(content, this.modifiers)
    }

    return applyModifiers(`Type.Boolean()`, this.modifiers)
  }
}
