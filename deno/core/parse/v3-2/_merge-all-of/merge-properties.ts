import type { SchemaObject, GetRefFn } from './types.ts'
import { mergeSchemasOrRefs } from './merge.ts'
export const mergeProperties = (
  first: SchemaObject,
  second: SchemaObject,
  getRef: GetRefFn
): SchemaObject | undefined => {
  if (containsProperties(first, second)) {
    const properties = { ...first.properties }

    if (!properties) {
      return {
        properties: second.properties
      }
    }

    for (const key in second.properties) {
      if (key in properties) {
        properties[key] = mergeSchemasOrRefs(properties[key], second.properties[key], getRef)
      } else {
        properties[key] = second.properties[key]
      }
    }

    return {
      properties
    }
  }
}

const containsProperties = (first: SchemaObject, second: SchemaObject): boolean => {
  return Boolean(first.properties || second.properties)
}
