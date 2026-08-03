import type { Modifiers, Stringable } from '@skmtc/core'

const withNullable = (value: Stringable, { nullable }: Modifiers): string => {
  return nullable ? `Type.Union([${value}, Type.Null()])` : `${value}`
}

const withOptional = (value: Stringable, { required }: Modifiers): string => {
  return required ? `${value}` : `Type.Optional(${value})`
}

export const applyModifiers = (content: string, modifiers: Modifiers): string => {
  return withOptional(withNullable(content, modifiers), modifiers)
}
