import { isEqual } from './is-equal.ts'
import type { SchemaObject } from './types.ts'
import * as v from 'valibot'

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
