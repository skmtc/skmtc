import type { Modifiers } from '@skmtc/core'

/**
 * Nullability wraps the value itself (`Type.Union([X, Type.Null()])`),
 * optionality wraps outermost (`Type.Optional(...)`) so an optional
 * nullable property reads `Type.Optional(Type.Union([X, Type.Null()]))`.
 */
export const applyModifiers = (content: string, { required, nullable }: Modifiers): string => {
  const withNull = nullable ? `Type.Union([${content}, Type.Null()])` : content

  return required ? withNull : `Type.Optional(${withNull})`
}
