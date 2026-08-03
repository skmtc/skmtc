import type { Modifiers } from '@skmtc/core'

/**
 * TypeBox modifiers wrap rather than suffix: nullable widens the schema
 * to a union with `Type.Null()`, and a non-required property is wrapped
 * in `Type.Optional(...)`. Nullability is applied innermost so the
 * optional wrapper always sits at the property level, where TypeBox
 * expects it.
 */
export const applyModifiers = (content: string, modifiers: Modifiers): string => {
  const postNullable = modifiers.nullable ? `Type.Union([${content}, Type.Null()])` : content

  return modifiers.required ? postNullable : `Type.Optional(${postNullable})`
}
