import type { Modifiers, Stringable } from '@skmtc/core'
import { LIB } from './lib.ts'

/**
 * SLOT(modifiers): how the target library expresses optional and
 * nullable. Applied ONCE, at each leaf's render — never while building
 * stored fields, and no other owner.
 *
 * effect composes by wrapping rather than by chaining: `Schema.NullOr`
 * widens the value type, and `Schema.optional` lifts a schema into a
 * PropertySignature. Nullability belongs to the value, so it wraps
 * first; optionality belongs to the property slot, so it wraps last and
 * stays outermost.
 */
export const applyModifiers = (
  value: Stringable,
  { required, nullable }: Modifiers,
): string => {
  const withNullable = nullable ? `${LIB}.NullOr(${value})` : `${value}`

  return required ? withNullable : `${LIB}.optional(${withNullable})`
}
