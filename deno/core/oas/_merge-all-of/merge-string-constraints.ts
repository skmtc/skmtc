import type { OpenAPIV3 } from 'openapi-types'
import { mergeEnumValues } from './merge-enum-values.ts'

export function mergeStringConstraints(
  a: OpenAPIV3.SchemaObject,
  b: OpenAPIV3.SchemaObject
): OpenAPIV3.SchemaObject {
  // If neither schema has a type, return empty object
  if (!a.type && !b.type) {
    return {}
  }

  // Check for type conflicts
  if (a.type && b.type && a.type !== b.type) {
    throw new Error(`Cannot merge schemas: conflicting types '${a.type}' and '${b.type}'`)
  }

  // If only one schema has a type and it's not string, return empty object
  if ((a.type && a.type !== 'string') || (b.type && b.type !== 'string')) {
    return {}
  }

  // First merge enum values if present
  const result = mergeEnumValues(a, b)

  // Then merge other constraints
  result.type = 'string'

  // Merge minLength
  if (a.minLength !== undefined || b.minLength !== undefined) {
    const minA = a.minLength ?? 0
    const minB = b.minLength ?? 0
    result.minLength = Math.max(minA, minB)
  }

  // Merge maxLength
  if (a.maxLength !== undefined || b.maxLength !== undefined) {
    const maxA = a.maxLength ?? Infinity
    const maxB = b.maxLength ?? Infinity
    result.maxLength = Math.min(maxA, maxB)
  }

  // Merge pattern
  if (a.pattern !== undefined && b.pattern !== undefined) {
    // If both have patterns, they must match
    if (a.pattern !== b.pattern) {
      throw new Error(
        `Cannot merge schemas: conflicting patterns '${a.pattern}' and '${b.pattern}'`
      )
    }
    result.pattern = a.pattern
  } else if (a.pattern !== undefined) {
    result.pattern = a.pattern
  } else if (b.pattern !== undefined) {
    result.pattern = b.pattern
  }

  // Merge format
  if (a.format !== undefined && b.format !== undefined) {
    // If both have formats, they must match
    if (a.format !== b.format) {
      throw new Error('Incompatible string formats')
    }
    result.format = a.format
  } else if (a.format !== undefined) {
    result.format = a.format
  } else if (b.format !== undefined) {
    result.format = b.format
  }

  return result
}
