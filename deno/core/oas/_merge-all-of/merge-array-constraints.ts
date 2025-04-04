import type { OpenAPIV3 } from 'openapi-types'
import { mergeEnumValues } from './merge-enum-values.ts'

export function mergeArrayConstraints(
  a: OpenAPIV3.SchemaObject,
  b: OpenAPIV3.SchemaObject
): OpenAPIV3.ArraySchemaObject {
  // If neither schema has a type, return empty object with required array properties
  if (!a.type && !b.type) {
    return { type: 'array', items: { type: 'string' } }
  }

  // Check for type conflicts
  if (a.type && b.type && a.type !== b.type) {
    throw new Error(`Cannot merge schemas: conflicting types '${a.type}' and '${b.type}'`)
  }

  // If only one schema has a type and it's not array, return empty array schema
  if ((a.type && a.type !== 'array') || (b.type && b.type !== 'array')) {
    return { type: 'array', items: { type: 'string' } }
  }

  // First merge enum values if present
  const baseResult = mergeEnumValues(a, b)
  const result = baseResult as OpenAPIV3.ArraySchemaObject

  // Then merge other constraints
  result.type = 'array'

  // Merge items
  const aArray = a as OpenAPIV3.ArraySchemaObject
  const bArray = b as OpenAPIV3.ArraySchemaObject
  result.items = aArray.items || bArray.items || { type: 'string' }

  // Merge minItems
  if (aArray.minItems !== undefined || bArray.minItems !== undefined) {
    const minA = aArray.minItems ?? 0
    const minB = bArray.minItems ?? 0
    result.minItems = Math.max(minA, minB)
  }

  // Merge maxItems
  if (aArray.maxItems !== undefined || bArray.maxItems !== undefined) {
    const maxA = aArray.maxItems ?? Infinity
    const maxB = bArray.maxItems ?? Infinity
    result.maxItems = Math.min(maxA, maxB)
  }

  // Merge uniqueItems
  if (aArray.uniqueItems || bArray.uniqueItems) {
    result.uniqueItems = true
  }

  return result
}
