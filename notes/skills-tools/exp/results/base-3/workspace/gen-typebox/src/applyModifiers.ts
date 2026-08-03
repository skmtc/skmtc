import type { Modifiers } from '@skmtc/core'

/**
 * TypeBox modifiers wrap rather than chain: nullable widens the schema to a
 * union with `Type.Null()`, then optionality wraps the result in
 * `Type.Optional(...)` so the wrapping order is stable regardless of which
 * modifiers are present.
 */
export const applyModifiers = (content: string, { required, nullable }: Modifiers): string => {
  const withNullable = nullable ? `Type.Union([${content}, Type.Null()])` : content

  return required ? withNullable : `Type.Optional(${withNullable})`
}
