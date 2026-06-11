import type { Stringable } from '@skmtc/core'

/**
 * Renders a C# attribute: `[JsonExtensionData]`,
 * `[JsonPropertyName("user_id")]`,
 * `[JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]`.
 *
 * Generic grammar only — args are {@link Stringable} and pre-quoted /
 * pre-built by the caller. WHICH attribute to emit is generator policy
 * (the serialization seam lives in `gen-csharp`; a Newtonsoft sibling
 * replaces the gen-side value files only); this package only renders
 * what it is handed.
 */
export class CsAttribute {
  name: string
  args: Stringable[]

  constructor(name: string, args: Stringable[] = []) {
    this.name = name
    this.args = args
  }

  toString(): string {
    return this.args.length ? `[${this.name}(${this.args.join(', ')})]` : `[${this.name}]`
  }
}

/**
 * The protocol by which a Definition's VALUE supplies class-level
 * attributes to {@link import('./CsDefinition.ts').CsDefinition}.
 *
 * `Lang.toDefinition`'s neutral signature has no attributes slot, so
 * attributes ride on the value: a generator's projection sets an
 * `attributes` field, and `CsDefinition.toString()` detects it via
 * {@link isCsAttributed} and renders the attributes one per line above
 * the declaration shell. Remember the spec-28 gotcha: the Driver wraps
 * the PROJECTION, so the projection must mirror the field as a getter.
 */
export type CsAttributed = {
  attributes: CsAttribute[]
}

/**
 * Type guard for the {@link CsAttributed} protocol — narrows without casts.
 */
export const isCsAttributed = (value: unknown): value is CsAttributed => {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  if (!('attributes' in value)) {
    return false
  }

  return (
    Array.isArray(value.attributes) && value.attributes.every(item => item instanceof CsAttribute)
  )
}
