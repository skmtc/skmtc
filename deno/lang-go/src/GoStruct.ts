import { capitalize } from '@skmtc/core'
import type { Stringable } from '@skmtc/core'

/** A single field of a {@link GoStruct}. */
export type GoFieldArgs = {
  /** The wire/schema name (lowercase) — used verbatim in the `json:"…"` tag. */
  name: string
  type: Stringable
  /**
   * Whether the field is exported. Go has no `public`/`private` keyword:
   * an exported field is **capitalized**, an unexported one stays
   * lowercase. Defaults to exported (DTO fields are JSON-serialized).
   */
  exported?: boolean
}

/**
 * Renders a Go `struct { … }` body — the value a {@link
 * import('./GoDefinition.ts').GoDefinition} wraps for a DTO.
 *
 * Demonstrates Go's signature constraint, **visibility via casing**: the
 * Go field name is capitalized when exported, lowercase otherwise, while
 * the `json:"…"` tag preserves the original wire name. Output is
 * unformatted (single-spaced) — `gofmt`-style column alignment is the
 * consumer's concern, never the pipeline's.
 */
export class GoStruct {
  fields: GoFieldArgs[]

  constructor(fields: GoFieldArgs[]) {
    this.fields = fields
  }

  toString(): string {
    const lines = this.fields.map(field => {
      const goName = field.exported === false ? field.name : capitalize(field.name)
      const tag = '`json:"' + field.name + '"`'
      return `\t${goName} ${field.type} ${tag}`
    })

    return `struct {\n${lines.join('\n')}\n}`
  }
}
