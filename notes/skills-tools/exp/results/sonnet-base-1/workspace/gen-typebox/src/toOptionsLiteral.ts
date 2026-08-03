/**
 * Renders a TypeBox schema options argument (e.g. the second argument to
 * `Type.String({ minLength: 3 })`) from a record of possibly-undefined
 * constraint values. Returns '' when every value is undefined, so callers
 * can splice it straight after `Type.Xxx()` with no empty `()`.
 */
export const toOptionsLiteral = (entries: Record<string, number | undefined>): string => {
  const pairs = Object.entries(entries).filter((entry): entry is [string, number] => {
    return entry[1] !== undefined
  })

  if (pairs.length === 0) {
    return ''
  }

  return `{ ${pairs.map(([key, value]) => `${key}: ${value}`).join(', ')} }`
}
