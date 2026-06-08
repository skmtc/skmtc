import type { Stringable } from '@skmtc/core'

/** A single `val` parameter of a {@link KtDataClass}. */
export type KtParameterArgs = {
  /** The property name (camelCase by convention). */
  name: string
  type: Stringable
  /** Whether the type is nullable (`Type?`). */
  nullable?: boolean
}

/**
 * Renders a Kotlin `data class` primary-constructor parameter list — the
 * value a {@link import('./KtDefinition.ts').KtDefinition} wraps for a
 * DTO. Each parameter is a public `val` property; the Definition assembles
 * the `data class Name( … )` shell.
 */
export class KtDataClass {
  parameters: KtParameterArgs[]

  constructor(parameters: KtParameterArgs[]) {
    this.parameters = parameters
  }

  toString(): string {
    return this.parameters
      .map(parameter => {
        const nullable = parameter.nullable ? '?' : ''
        return `    val ${parameter.name}: ${parameter.type}${nullable}`
      })
      .join(',\n')
  }
}
