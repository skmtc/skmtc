import type { Modifiers, Stringable } from '@skmtc/core'

export const withNullable = (value: Stringable, { nullable }: Modifiers): string => {
  return nullable ? `Type.Union([${value}, Type.Null()])` : `${value}`
}
