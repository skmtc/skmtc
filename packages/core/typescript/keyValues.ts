import { EMPTY } from '../dsl/constants.ts'
import type { Stringable } from '../dsl/Stringable.ts'

// Filter out properties with falsy or EMPTY values and return as joined string
export const keyValues = (properties: Record<string, Stringable>): string => {
  const filteredEntries = Object.entries(properties)
    .map(([key, value]) => {
      const renderedValue = value?.toString() || EMPTY

      return renderedValue === EMPTY ? EMPTY : `${key}: ${renderedValue}`
    })
    .filter(row => row !== EMPTY)

  return filteredEntries.length ? `{${filteredEntries.join(',\n')}}` : EMPTY
}
