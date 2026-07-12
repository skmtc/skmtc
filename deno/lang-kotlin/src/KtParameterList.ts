import type { Stringable } from '@skmtc/core'
import type { KtAnnotation } from './KtAnnotation.ts'

/** A single primary-constructor parameter of a Kotlin class. */
export type KtParameterArgs = {
  /**
   * The FINAL property name — already sanitized by the generator
   * (`sanitizePropertyName(camelCase(wireName))`); may be backticked.
   */
  name: string
  type: Stringable
  /** Whether the type is nullable (`Type?`). */
  nullable?: boolean
  /** Optional default (` = …`), e.g. `'null'` for optional properties. */
  defaultValue?: Stringable
  /** Inline annotations rendered before `val` (e.g. `@SerialName("…")`). */
  annotations?: KtAnnotation[]
  /**
   * Visibility modifier rendered after the annotations, before `val`
   * (`@Anno private val service: …` — Kotlin's conventional order).
   * Absent = Kotlin's public default — keyword only to restrict.
   */
  visibility?: 'private' | 'protected' | 'internal'
}

/**
 * Renders a Kotlin primary-constructor parameter list — the value a
 * {@link import('./KtDefinition.ts').KtDefinition} wraps for a
 * `data class` DTO. Each parameter is a public `val` property; the
 * Definition assembles the `data class Name( … )` shell.
 *
 * No trailing comma after the last parameter — a cosmetic non-decision:
 * trailing commas are the consumer's formatter's territory (ktfmt adds
 * them, ktlint can enforce either way) and SKMTC renders unformatted by
 * design.
 */
export class KtParameterList {
  parameters: KtParameterArgs[]

  constructor(parameters: KtParameterArgs[]) {
    this.parameters = parameters
  }

  toString(): string {
    return this.parameters
      .map(parameter => {
        const visibility = parameter.visibility ? `${parameter.visibility} ` : ''
        const annotations = parameter.annotations?.length
          ? parameter.annotations.map(annotation => `${annotation} `).join('')
          : ''
        const nullable = parameter.nullable ? '?' : ''
        const defaultValue =
          parameter.defaultValue !== undefined ? ` = ${parameter.defaultValue}` : ''

        return `    ${annotations}${visibility}val ${parameter.name}: ${parameter.type}${nullable}${defaultValue}`
      })
      .join(',\n')
  }
}
