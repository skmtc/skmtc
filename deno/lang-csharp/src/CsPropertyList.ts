import type { Stringable } from '@skmtc/core'
import type { CsAttribute } from './CsAttribute.ts'

/** A single property member of a C# record body. */
export type CsPropertyArgs = {
  /**
   * The FINAL property name — already PascalCased and sanitized by the
   * generator (`sanitizePropertyName(pascalCase(wireName))`); may be
   * `@`-prefixed.
   */
  name: string
  type: Stringable
  /** Whether the type is nullable (`Type?`). The type expression is the single `?` owner; nothing else adds one. */
  nullable?: boolean
  /** Whether the property carries the `required` modifier (spec-required, D4). */
  required?: boolean
  /** Attributes rendered one per line above the property (e.g. `[JsonPropertyName("…")]`). */
  attributes?: CsAttribute[]
}

/**
 * Renders the property members of a C# record body — the value a
 * {@link import('./CsDefinition.ts').CsDefinition} wraps for a nominal
 * DTO record (D3). Statement-shaped, blank-line-joined, attributes on
 * their own lines — a different construct geometry from Kotlin's
 * comma-joined `KtParameterList` (D3 chose nominal records over
 * positional precisely to get this shape):
 *
 * ```csharp
 *     [JsonPropertyName("user_id")]
 *     public required string UserId { get; init; }
 * ```
 *
 * Every property is `public` with `{ get; init; }` — DTO members have no
 * per-property visibility, and mutation is the consumer's non-generated
 * `partial` half's business. No `= null` defaults: null already is the
 * default (D4).
 */
export class CsPropertyList {
  properties: CsPropertyArgs[]

  constructor(properties: CsPropertyArgs[]) {
    this.properties = properties
  }

  toString(): string {
    return this.properties
      .map(property => {
        const attributes = property.attributes?.length
          ? property.attributes.map(attribute => `    ${attribute}\n`).join('')
          : ''
        const required = property.required ? 'required ' : ''
        const nullable = property.nullable ? '?' : ''

        return `${attributes}    public ${required}${property.type}${nullable} ${property.name} { get; init; }`
      })
      .join('\n\n')
  }
}
