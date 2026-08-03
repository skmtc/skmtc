import { TsSnippet } from '@skmtc/lang-typescript'
import type {
  GenerateContextType,
  GeneratorKey,
  Modifiers,
  OasString,
} from '@skmtc/core'
import { applyModifiers } from './modifiers.ts'
import { LIB, LIB_MODULE } from './lib.ts'

type MyLibStringArgs = {
  context: GenerateContextType
  stringSchema: OasString
  modifiers: Modifiers
  destinationPath: string
  generatorKey: GeneratorKey
}

export class MyLibString extends TsSnippet {
  type = 'string' as const
  stringSchema: OasString
  // format + enums are part of the TypeSystemString contract peers rely on.
  format: string | undefined
  enums: string[] | (string | null)[] | undefined
  modifiers: Modifiers

  constructor(
    { context, stringSchema, generatorKey, destinationPath, modifiers }:
      MyLibStringArgs,
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
    // A single-member enum is a literal; a null member comes from
    // OpenAPI 3.1-style nullable enums and must not be quoted.
    const content = enums?.length
      ? enums.length === 1
        ? `${LIB}.literal(${literal(enums[0])})`
        : `${LIB}.enum([${enums.map(literal).join(', ')}])`
      : `${LIB}.string()`

    // SLOT(string-constraints): minLength / maxLength / pattern /
    // format live on this.stringSchema — append target syntax here.
    return applyModifiers(content, this.modifiers)
  }
}

const literal = (
  value: string | null,
): string => (value === null ? 'null' : `'${value}'`)
