import { TsSnippet } from '@skmtc/lang-typescript'
import type {
  GenerateContextType,
  GeneratorKey,
  Modifiers,
  OasString,
} from '@skmtc/core'
import { applyModifiers } from './modifiers.ts'
import { LIB, LIB_MODULE } from './lib.ts'

type EffectSchemaStringArgs = {
  context: GenerateContextType
  stringSchema: OasString
  modifiers: Modifiers
  destinationPath: string
  generatorKey: GeneratorKey
}

export class EffectSchemaString extends TsSnippet {
  type = 'string' as const
  stringSchema: OasString
  // format + enums are part of the TypeSystemString contract peers rely on.
  format: string | undefined
  enums: string[] | (string | null)[] | undefined
  modifiers: Modifiers

  constructor(
    { context, stringSchema, generatorKey, destinationPath, modifiers }:
      EffectSchemaStringArgs,
  ) {
    super({
      context,
      generatorKey,
      stackTrail: stringSchema.stackTrail.clone(),
    })

    this.stringSchema = stringSchema
    this.format = stringSchema.format
    this.enums = stringSchema.enums
    this.modifiers = modifiers

    this.register({ imports: { [LIB_MODULE]: [LIB] }, destinationPath })
  }

  override toString(): string {
    const { enums } = this

    // SLOT(string): the target syntax for strings, enums and literals.
    // effect spreads enum members as variadic arguments to a single
    // `Schema.Literal`, which also covers the single-member case. A
    // null member comes from OpenAPI 3.1-style nullable enums and is a
    // valid effect literal, so it must not be quoted.
    const content = enums?.length
      ? `${LIB}.Literal(${enums.map(literal).join(', ')})`
      : `${LIB}.String`

    // SLOT(string-constraints): minLength / maxLength / pattern /
    // format live on this.stringSchema — append target syntax here
    // (effect: `.pipe(Schema.minLength(n))`).
    return applyModifiers(content, this.modifiers)
  }
}

const literal = (
  value: string | null,
): string => (value === null ? 'null' : `'${value}'`)
