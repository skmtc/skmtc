import type { SchemaObject } from './types.ts'

type SchemaType = 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array'

export const checkAtLeastOneTypeMatch = (
  first: SchemaObject,
  second: SchemaObject,
  type: SchemaType
): boolean => {
  return (
    (first.type === type && second.type === type) ||
    (first.type === type && !second.type) ||
    (!first.type && second.type === type)
  )
}
