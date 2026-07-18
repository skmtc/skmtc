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
  /** Annotations rendered one per line above the parameter (e.g. `@SerialName("…")`). */
  annotations?: KtAnnotation[]
  /**
   * Visibility modifier rendered after the annotations, before `val`
   * (`@Anno private val service: …` — Kotlin's conventional order).
   * Absent = Kotlin's public default — keyword only to restrict.
   */
  visibility?: 'private' | 'protected' | 'internal'
}

/**
 * Renders a Kotlin primary-constructor parameter list, **parentheses
 * included** — `(\n    val id: String\n)`. The value owns its
 * delimiters: a data-class value interpolates this directly
 * (`${parameters}${supertypeClause}`), and the definition renders only
 * `${head}${value}`. Each parameter is a `val` property (public by
 * default).
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
    const parameters = this.parameters
      .map(parameter => {
        const visibility = parameter.visibility ? `${parameter.visibility} ` : ''
        const annotations = parameter.annotations?.length
          ? parameter.annotations.map(annotation => `    ${annotation}\n`).join('')
          : ''
        const nullable = parameter.nullable ? '?' : ''
        const defaultValue =
          parameter.defaultValue !== undefined ? ` = ${parameter.defaultValue}` : ''

        return `${annotations}    ${visibility}val ${parameter.name}: ${parameter.type}${nullable}${defaultValue}`
      })
      .join(',\n')

    return `(\n${parameters}\n)`
  }
}
