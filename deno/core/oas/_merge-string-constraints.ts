import type { OpenAPIV3 } from 'openapi-types'

export const mergeStringConstraints = (
  a: OpenAPIV3.SchemaObject,
  b: OpenAPIV3.SchemaObject
): Partial<OpenAPIV3.SchemaObject> => {
  // If neither schema is a string, return empty object
  if (a.type !== 'string' && b.type !== 'string') {
    return {}
  }

  // If only one schema is a string, return that schema's constraints
  if (a.type !== 'string') {
    return {
      type: 'string',
      minLength: b.minLength,
      maxLength: b.maxLength,
      pattern: b.pattern
    }
  }
  if (b.type !== 'string') {
    return {
      type: 'string',
      minLength: a.minLength,
      maxLength: a.maxLength,
      pattern: a.pattern
    }
  }

  // Both schemas are strings, check for pattern conflicts
  if (a.pattern && b.pattern && a.pattern !== b.pattern) {
    throw new Error(`Cannot merge schemas: conflicting patterns '${a.pattern}' and '${b.pattern}'`)
  }

  const result: Partial<OpenAPIV3.SchemaObject> = {
    type: 'string'
  }

  if (b.minLength !== undefined) result.minLength = Math.max(a.minLength ?? 0, b.minLength)
  if (b.maxLength !== undefined) result.maxLength = Math.min(a.maxLength ?? Infinity, b.maxLength)
  if (b.pattern !== undefined) result.pattern = b.pattern

  return result
}
