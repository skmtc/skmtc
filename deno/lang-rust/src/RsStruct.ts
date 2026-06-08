import type { Stringable } from '@skmtc/core'

/** A single field of a {@link RsStruct}. */
export type RsFieldArgs = {
  /** The field name — used verbatim (Rust DTO fields are snake_case by convention). */
  name: string
  type: Stringable
  /**
   * Whether the field is exposed. Rust has no casing-based visibility:
   * an exposed field gets the **`pub` keyword**, an unexposed one gets
   * nothing — the name is unchanged either way. Defaults to `pub`
   * (DTO fields are serialized). Contrast {@link import('@skmtc/lang-go').GoStruct},
   * where the same intent flips the name's casing instead.
   */
  exported?: boolean
}

/**
 * Renders a Rust `struct { … }` body — the value an {@link
 * import('./RsDefinition.ts').RsDefinition} wraps for an object DTO.
 *
 * Demonstrates Rust's **visibility-via-`pub`-keyword**: a contrast to Go's
 * visibility-via-casing, both driven from the same neutral `exported`
 * fact. Output is unformatted (tab-indented, no column alignment) —
 * `rustfmt` is the consumer's concern, never the pipeline's.
 */
export class RsStruct {
  fields: RsFieldArgs[]

  constructor(fields: RsFieldArgs[]) {
    this.fields = fields
  }

  toString(): string {
    const lines = this.fields.map(field => {
      const vis = field.exported === false ? '' : 'pub '
      return `\t${vis}${field.name}: ${field.type},`
    })

    return `{\n${lines.join('\n')}\n}`
  }
}
