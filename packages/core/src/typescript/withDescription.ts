import type { Stringable } from '../dsl/Stringable.js'
import type { Modifiers } from '../types/Modifiers.js'

export const withDescription = (
  value: Stringable,
  { description }: Modifiers
): string => {
  return description ? `/** ${description} */\n${value}` : `${value}`
}
