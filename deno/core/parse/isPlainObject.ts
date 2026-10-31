/** A non-null object that is not an array. */
export const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Name the kind of a value for an error message: `null`, `an array`, or its `typeof`. */
export const toKind = (value: unknown): string =>
  value === null ? 'null' : Array.isArray(value) ? 'an array' : typeof value
