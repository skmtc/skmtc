import type { Modifiers } from '@skmtc/core'

/**
 * Apply nullability and optionality to a rendered TypeBox expression.
 * Nullable widens to `Type.Union([T, Type.Null()])`; a non-required
 * property wraps in `Type.Optional(...)` (outermost, so optionality
 * stays on the property itself).
 */
export const applyModifiers = (content: string, { required, nullable }: Modifiers): string => {
  const withNullable = nullable ? `Type.Union([${content}, Type.Null()])` : content

  return required ? withNullable : `Type.Optional(${withNullable})`
}
