import type { Modifiers, Stringable } from '@skmtc/core'
import { LIB } from './lib.ts'

/**
 * SLOT(modifiers): how the target library expresses optional and
 * nullable. Applied ONCE, at each leaf's render — never while building
 * stored fields, and no other owner. Order matters: nullable wraps the
 * value first, optional wraps the result (zod convention; adjust if
 * your library composes differently).
 */
export const applyModifiers = (
  value: Stringable,
  { required, nullable }: Modifiers,
): string => {
  const withNullable = nullable ? `${LIB}.NullOr(${value})` : `${value}`

  return required ? withNullable : `${LIB}.optional(${withNullable})`
}
