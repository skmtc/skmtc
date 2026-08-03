import type { Modifiers, Stringable } from '@skmtc/core'

export const withOptional = (value: Stringable, { required }: Modifiers): string => {
  return required ? `${value}` : `Type.Optional(${value})`
}
