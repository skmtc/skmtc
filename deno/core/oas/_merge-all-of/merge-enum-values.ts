import type { OpenAPIV3 } from 'openapi-types'

function isEqual(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    return a.every((value, index) => isEqual(value, b[index]))
  }
  if (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null) {
    const aKeys = Object.keys(a)
    const bKeys = Object.keys(b)
    if (aKeys.length !== bKeys.length) return false
    return aKeys.every(
      key =>
        bKeys.includes(key) &&
        isEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
    )
  }
  return a === b
}

export function mergeEnumValues(
  a: OpenAPIV3.SchemaObject,
  b: OpenAPIV3.SchemaObject
): OpenAPIV3.SchemaObject {
  // If either schema doesn't have an enum, return the one that does
  if (!a.enum) return { ...b }
  if (!b.enum) return { ...a }

  // Find intersection of enum values
  const intersection = a.enum.filter(value => b.enum!.some(bValue => isEqual(value, bValue)))

  // If intersection is empty, throw error
  if (intersection.length === 0) {
    throw new Error('Merged schema has empty enum array')
  }

  // Return merged schema with intersection of enum values
  return {
    ...a,
    ...b,
    enum: intersection
  }
}
