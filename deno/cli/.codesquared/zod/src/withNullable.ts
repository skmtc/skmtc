import type { Stringable } from '@skmtc/core'
import type { Modifiers } from '@skmtc/core'

export const withNullable = (
  value: Stringable,
  { nullable }: Modifiers
): string => {
  return nullable ? `${value}.nullable()` : `${value}`
}
