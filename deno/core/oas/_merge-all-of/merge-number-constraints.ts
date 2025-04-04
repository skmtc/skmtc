import type { OpenAPIV3 } from 'openapi-types'
import { mergeEnumValues } from './merge-enum-values.ts'

export function mergeNumberConstraints(
  a: OpenAPIV3.SchemaObject,
  b: OpenAPIV3.SchemaObject
): OpenAPIV3.SchemaObject {
  // If either schema is not a number, return the one that is
  if (a.type !== 'number') return { ...b }
  if (b.type !== 'number') return { ...a }

  // First merge enum values if present
  const result = mergeEnumValues(a, b)

  // Then merge other constraints
  result.type = 'number'

  // Merge minimum and exclusiveMinimum
  if (a.minimum !== undefined || b.minimum !== undefined) {
    const minA = a.minimum ?? -Infinity
    const minB = b.minimum ?? -Infinity
    result.minimum = Math.max(minA, minB)

    // If either minimum is exclusive, the result is exclusive
    if (a.exclusiveMinimum || b.exclusiveMinimum) {
      result.exclusiveMinimum = true
    }
  }

  // Merge maximum and exclusiveMaximum
  if (a.maximum !== undefined || b.maximum !== undefined) {
    const maxA = a.maximum ?? Infinity
    const maxB = b.maximum ?? Infinity
    result.maximum = Math.min(maxA, maxB)

    // If either maximum is exclusive, the result is exclusive
    if (a.exclusiveMaximum || b.exclusiveMaximum) {
      result.exclusiveMaximum = true
    }
  }

  // Merge multipleOf
  if (a.multipleOf !== undefined && b.multipleOf !== undefined) {
    result.multipleOf = a.multipleOf * b.multipleOf
  } else if (a.multipleOf !== undefined) {
    result.multipleOf = a.multipleOf
  } else if (b.multipleOf !== undefined) {
    result.multipleOf = b.multipleOf
  }

  return result
}
