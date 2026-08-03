import type { Modifiers, Stringable } from '@skmtc/core'
import { LIB } from './lib.ts'

/**
 * SLOT(modifiers): how the target library expresses optional and
 * nullable. Applied ONCE, at each leaf's render — never while building
 * stored fields, and no other owner.
 *
 * effect composes by wrapping, not by chaining: `Schema.NullOr(x)` and
 * `Schema.optional(x)` are combinators. Nullable wraps the value first,
 * optional wraps the result — so an optional nullable string renders
 * `Schema.optional(Schema.NullOr(Schema.String))`, matching effect's
 * "the key may be absent, and when present may be null" reading.
 */
export const applyModifiers = (
  value: Stringable,
  { required, nullable }: Modifiers,
): string => {
  const withNullable = nullable ? `${LIB}.NullOr(${value})` : `${value}`

  return required ? withNullable : `${LIB}.optional(${withNullable})`
}
