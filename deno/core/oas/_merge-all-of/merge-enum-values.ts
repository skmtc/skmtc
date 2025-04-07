import type { SchemaObject } from './types.ts'
import * as v from 'valibot'

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

const containsEnum = (schema: SchemaObject): boolean => {
  return Array.isArray(schema.enum)
}

export function mergeEnumValues<T>(
  first: SchemaObject,
  second: SchemaObject,
  typeCheck?: v.GenericSchema<T>
): Pick<SchemaObject, 'enum'> {
  if (!containsEnum(first) && !containsEnum(second)) {
    return {}
  }

  if (!containsEnum(first) && containsEnum(second)) {
    return {
      enum: second.enum
    }
  }

  if (containsEnum(first) && !containsEnum(second)) {
    return {
      enum: first.enum
    }
  }

  // Find intersection of enum values
  const intersection = first
    .enum!.filter(value => second.enum!.some(bValue => isEqual(value, bValue)))
    .map(value => (typeCheck ? v.parse(typeCheck, value) : value))

  // If intersection is empty, throw error
  if (intersection.length === 0) {
    throw new Error('Merged schema has empty enum array')
  }

  // Return merged schema with intersection of enum values
  return {
    enum: intersection
  }
}
