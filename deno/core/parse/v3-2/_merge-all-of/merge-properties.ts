import type { SchemaObject, MergeArgs } from './types.ts'
import { mergeSchemasOrRefs } from './merge.ts'
export const mergeProperties = ({ first, second, getRef, normalize, system }: MergeArgs<SchemaObject>): SchemaObject | undefined => {
  if (containsProperties(first, second)) {
    const properties = { ...first.properties }

    if (!properties) {
      return {
        properties: second.properties
      }
    }

    for (const key in second.properties) {
      if (key in properties) {
        properties[key] = mergeSchemasOrRefs({ first: properties[key], second: second.properties[key], getRef, normalize, system })
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
