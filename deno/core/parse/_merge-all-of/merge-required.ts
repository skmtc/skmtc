import type { SchemaObject } from './types.ts'

export const containsRequired = (first: SchemaObject, second: SchemaObject): boolean => {
  return Boolean(first.required || second.required)
}

export const mergeRequired = (
  first: SchemaObject,
  second: SchemaObject
): SchemaObject | undefined => {
  if (containsRequired(first, second)) {
    return {
      required: [...(first.required ?? []), ...(second.required ?? [])]
    }
  }
}
