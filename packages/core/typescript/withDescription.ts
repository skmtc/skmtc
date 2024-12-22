import type { Stringable } from '../dsl/Stringable.ts'
import type { Modifiers } from '../types/Modifiers.ts'

export const withDescription = (
  value: Stringable,
  { description }: Modifiers
): string => {
  return description ? `/** ${description} */\n${value}` : `${value}`
}
