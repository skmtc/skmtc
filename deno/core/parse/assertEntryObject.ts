export type AssertEntryObjectArgs = {
  value: unknown
  /** Names the entry in the message, e.g. `Request body`. */
  label: string
}

/**
 * Throw when a component entry is not a plain object (`null`, an array, a
 * string). Called inside a `tryParseAt` boundary, so the entry is dropped
 * with an error: consumers reference it by name, and leaving it out
 * silently would change what they render.
 */
export const assertEntryObject = ({ value, label }: AssertEntryObjectArgs): void => {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return
  }

  const actual = value === null ? 'null' : Array.isArray(value) ? 'an array' : typeof value

  throw new Error(`${label} must be an object, got ${actual}`)
}
