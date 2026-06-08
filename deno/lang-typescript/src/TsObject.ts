import type { Stringable } from '@skmtc/core'

/** A single property of a {@link TsObject} type literal. */
export type TsPropertyArgs = {
  name: string
  /** The property's type — any `Stringable` (a string, another DSL node). */
  type: Stringable
  optional?: boolean
}

/**
 * Renders a TypeScript object type literal — the record `value` a
 * {@link import('./TsDefinition.ts').TsDefinition} wraps for a DTO.
 *
 * Composes with any `Stringable` property type, so nested objects and
 * other DSL nodes interpolate without special-casing.
 */
export class TsObject {
  properties: TsPropertyArgs[]

  constructor(properties: TsPropertyArgs[]) {
    this.properties = properties
  }

  toString(): string {
    const lines = this.properties.map(
      property => `  ${property.name}${property.optional ? '?' : ''}: ${property.type}`
    )

    return `{\n${lines.join('\n')}\n}`
  }
}
