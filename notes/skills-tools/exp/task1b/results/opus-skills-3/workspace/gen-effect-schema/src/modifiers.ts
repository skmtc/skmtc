import type { Modifiers, Stringable } from '@skmtc/core'
import { LIB } from './lib.ts'

/**
 * SLOT(modifiers): how the target library expresses optional and
 * nullable. Applied ONCE, at each leaf's render — never while building
 * stored fields, and no other owner.
 *
 * effect composes by wrapping rather than chaining: `Schema.NullOr(v)`
 * admits `null`, `Schema.optional(v)` makes a struct field optional.
 * Nullable wraps the value first so an optional-and-nullable property
 * renders `Schema.optional(Schema.NullOr(v))` — `Schema.optional`
 * produces a PropertySignature and so must stay outermost.
 */
export const applyModifiers = (
  value: Stringable,
  { required, nullable }: Modifiers,
): string => {
  const withNullable = nullable ? `${LIB}.NullOr(${value})` : `${value}`

  return required ? withNullable : `${LIB}.optional(${withNullable})`
}
