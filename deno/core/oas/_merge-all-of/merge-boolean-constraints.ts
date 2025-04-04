import type { OpenAPIV3 } from 'openapi-types'
import { mergeEnumValues } from './merge-enum-values.ts'

export function mergeBooleanConstraints(
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

  // If only one schema has a type and it's not boolean, return empty object
  if ((a.type && a.type !== 'boolean') || (b.type && b.type !== 'boolean')) {
    return {}
  }

  // First merge enum values if present
  const result = mergeEnumValues(a, b)

  // Then set type
  result.type = 'boolean'

  return result
}
