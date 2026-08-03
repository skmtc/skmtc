import { camelCase } from '@skmtc/core'
import { KtAnnotation, KtSnippet, sanitizePropertyName } from '@skmtc/lang-kotlin'
import type {
  GenerateContextType,
  GeneratorKey,
  OasString,
} from '@skmtc/core'
import { JACKSON_ANNOTATION_PACKAGE, JSON_PROPERTY } from './lib.ts'

type KotlinEnumEntriesArgs = {
  context: GenerateContextType
  destinationPath: string
  stringSchema: OasString
  generatorKey: GeneratorKey
}

type EnumEntry = {
  name: string
  annotations: KtAnnotation[]
}

/**
 * SCREAMING_SNAKE_CASE, Kotlin's enum-entry convention: `in_progress` →
 * `IN_PROGRESS`. Routed through `camelCase` first so that every wire
 * separator (`-`, `_`, space) is normalised to one word boundary before
 * the boundaries are re-expanded as underscores.
 */
const toEnumEntryName = (value: string): string => {
  const constantCase = camelCase(value)
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toUpperCase()

  // `camelCase` strips non-alphanumerics, so a wire value made only of
  // them (or the empty string) leaves nothing to name.
  return sanitizePropertyName(constantCase.length ? constantCase : 'EMPTY')
}

/**
 * The VALUE of an `enum class` — the ` { … }` body that renders after the
 * `enum class Name` head.
 *
 * Jackson reads and writes the wire form through `@JsonProperty` on the
 * entry, which it honours on enum constants in both directions. The
 * annotation is emitted only where the Kotlin entry name differs from the
 * wire value.
 */
export class KotlinEnumEntries extends KtSnippet {
  type = 'enum-entries' as const
  entries: EnumEntry[]

  constructor(
    { context, destinationPath, stringSchema, generatorKey }:
      KotlinEnumEntriesArgs,
  ) {
    super({
      context,
      generatorKey,
      stackTrail: stringSchema.stackTrail.clone(),
    })

    const enums: readonly (string | null)[] = stringSchema.enums ?? []

    this.entries = enums
      // A `null` member is OpenAPI 3.1's nullable-enum idiom; it is a
      // nullability fact about the property, not an entry to declare.
      .filter((value): value is string => value !== null)
      .map((value) => {
        const name = toEnumEntryName(value)

        return {
          name,
          annotations: name.replaceAll('`', '') === value ? [] : [
            new KtAnnotation({
              context,
              destinationPath,
              name: JSON_PROPERTY,
              packageName: JACKSON_ANNOTATION_PACKAGE,
              args: [`"${value}"`],
            }),
          ],
        }
      })
  }

  override toString(): string {
    const entries = this.entries
      .map((entry) => {
        const annotations = entry.annotations
          .map((annotation) => `    ${annotation}\n`)
          .join('')

        return `${annotations}    ${entry.name}`
      })
      .join(',\n')

    return ` {\n${entries}\n}`
  }
}
