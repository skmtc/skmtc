import type { Modifiers } from '@skmtc/core'

/**
 * Wrap already-rendered TypeBox content with its nullability and
 * optionality wrappers. Called only from `toString()` bodies — the one
 * owner of modifier application, at the leaf's render.
 */
export const applyModifiers = (content: string, modifiers: Modifiers): string => {
  const withNull = modifiers.nullable ? `Type.Union([${content}, Type.Null()])` : content

  return modifiers.required ? withNull : `Type.Optional(${withNull})`
}
