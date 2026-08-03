import type { Modifiers, Stringable } from 'jsr:@skmtc/core@0.28.3'

export const withOptional = (value: Stringable, { required }: Modifiers): string => {
  return required ? `${value}` : `Type.Optional(${value})`
}
