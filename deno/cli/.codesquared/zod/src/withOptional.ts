import type { Stringable } from '@skmtc/core'
import type { Modifiers } from '@skmtc/core'

export const withOptional = (value: Stringable, { required }: Modifiers): string => {
  return required ? `${value}` : `${value}.optional()`
}
