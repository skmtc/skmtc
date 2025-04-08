import type { OpenAPIV3 } from 'openapi-types'
import { mergeSchemasOrRefs } from './merge.ts'
import { genericMerge } from './generic-merge.ts'
import * as v from 'valibot'
import { checkTypeConflicts } from './check-type-conflicts.ts'
type SchemaObject = OpenAPIV3.SchemaObject
type ReferenceObject = OpenAPIV3.ReferenceObject

export const mergeObjectConstraints = (
  first: SchemaObject,
  second: SchemaObject,
  getRef: (ref: ReferenceObject) => SchemaObject
): SchemaObject => {
  // Check for type conflicts
  checkTypeConflicts(first, second)

  const result: SchemaObject = genericMerge(first, second, getRef, v.record(v.string(), v.any()))

  if (
    typeof second.additionalProperties === 'object' &&
    typeof first.additionalProperties === 'object'
  ) {
    // If both have additionalProperties as schemas, merge them
    result.additionalProperties = mergeSchemasOrRefs(
      first.additionalProperties,
      second.additionalProperties,
      getRef
    )
  } else if (second.additionalProperties !== undefined) {
    result.additionalProperties = second.additionalProperties
  } else if (first.additionalProperties !== undefined) {
    result.additionalProperties = first.additionalProperties
  }

  // Merge minProperties and maxProperties
  if (second.minProperties !== undefined || first.minProperties !== undefined) {
    result.minProperties = Math.max(second.minProperties ?? 0, first.minProperties ?? 0)
  }

  if (second.maxProperties !== undefined || first.maxProperties !== undefined) {
    result.maxProperties = Math.min(
      second.maxProperties ?? Infinity,
      first.maxProperties ?? Infinity
    )
  }

  return result
}
