import type { Modifiers, Stringable } from 'jsr:@skmtc/core@0.28.3'

export const withNullable = (value: Stringable, { nullable }: Modifiers): string => {
  return nullable ? `Type.Union([${value}, Type.Null()])` : `${value}`
}
