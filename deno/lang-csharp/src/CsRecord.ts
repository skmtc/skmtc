import type { Stringable } from '@skmtc/core'

/** A single positional parameter of a {@link CsRecord}. */
export type CsParameterArgs = {
  /** The parameter / generated property name (PascalCase by convention). */
  name: string
  type: Stringable
  /** Whether the type is a nullable reference type (`type?`). */
  nullable?: boolean
}

/**
 * Renders a C# positional `record` parameter list — the value a {@link
 * import('./CsDefinition.ts').CsDefinition} wraps for a DTO.
 *
 * C# positional record parameters are always public init-only properties,
 * so there is no per-parameter visibility (contrast PHP's promoted
 * constructor, where each member carries `public`/`private`). The value
 * renders only the parameter list; the Definition assembles the
 * `public record Name( … );` shell — the same shell/body split TS, Go,
 * Rust, and PHP use.
 */
export class CsRecord {
  parameters: CsParameterArgs[]

  constructor(parameters: CsParameterArgs[]) {
    this.parameters = parameters
  }

  toString(): string {
    return this.parameters
      .map(parameter => {
        const nullable = parameter.nullable ? '?' : ''
        return `    ${parameter.type}${nullable} ${parameter.name}`
      })
      .join(',\n')
  }
}
