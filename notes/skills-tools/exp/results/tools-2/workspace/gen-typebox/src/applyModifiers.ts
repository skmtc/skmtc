import type { Modifiers } from '@skmtc/core'

export const applyModifiers = (content: string, modifiers: Modifiers): string => {
  const postNullable = modifiers.nullable ? `Type.Union([${content}, Type.Null()])` : content

  return modifiers.required ? postNullable : `Type.Optional(${postNullable})`
}
