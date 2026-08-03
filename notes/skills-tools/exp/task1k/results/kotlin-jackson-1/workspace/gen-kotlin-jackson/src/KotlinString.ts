import { KtSnippet } from '@skmtc/lang-kotlin'
import type {
  GenerateContextType,
  GeneratorKey,
  Modifiers,
  OasString,
} from '@skmtc/core'
import { applyModifiers } from './modifiers.ts'

type KotlinStringArgs = {
  context: GenerateContextType
  stringSchema: OasString
  modifiers: Modifiers
  destinationPath: string
  generatorKey: GeneratorKey
}

export class KotlinString extends KtSnippet {
  type = 'string' as const
  stringSchema: OasString
  // format + enums are part of the TypeSystemString contract peers rely on.
  format: string | undefined
  enums: string[] | (string | null)[] | undefined
  modifiers: Modifiers

  constructor(
    { context, stringSchema, generatorKey, modifiers }: KotlinStringArgs,
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
  }

  override toString(): string {
    // SLOT(string): Kotlin has no anonymous enum or literal TYPE, so an
    // INLINE enum widens to `String`. A top-level enum is a different
    // thing entirely — it has a name, so `KotlinProjection` gives it an
    // `enum class` of its own (see shape.ts).
    //
    // SLOT(string-constraints): minLength / maxLength / pattern / format
    // live on this.stringSchema; Kotlin's type system cannot express them,
    // so they are dropped rather than encoded.
    return applyModifiers('String', this.modifiers)
  }
}
