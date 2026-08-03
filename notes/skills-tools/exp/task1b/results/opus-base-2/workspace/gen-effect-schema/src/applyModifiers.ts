import type { Modifiers, Stringable } from '@skmtc/core'
import { SCHEMA } from './constants.ts'

/** `nullable: true` → `Schema.NullOr(value)`. */
export const withNullable = (value: Stringable, { nullable }: Modifiers): string => {
  return nullable ? `${SCHEMA}.NullOr(${value})` : `${value}`
}

/** A property absent from the schema's `required` list → `Schema.optional(value)`. */
export const withOptional = (value: Stringable, { required }: Modifiers): string => {
  return required ? `${value}` : `${SCHEMA}.optional(${value})`
}

/**
 * Wraps a rendered schema in its modifiers, nullable innermost — a property
 * that is both optional and nullable renders
 * `Schema.optional(Schema.NullOr(…))`, which is the combination effect's
 * `Struct` understands (an optional field whose present value may be null).
 */
export const applyModifiers = (content: Stringable, modifiers: Modifiers): string => {
  return withOptional(withNullable(content, modifiers), modifiers)
}
