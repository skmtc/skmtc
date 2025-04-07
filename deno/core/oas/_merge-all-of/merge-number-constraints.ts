import type { OpenAPIV3 } from 'openapi-types'
import type { SchemaObject } from './types.ts'
import { genericMerge } from './generic-merge.ts'
import type { GetRefFn } from './types.ts'
import * as v from 'valibot'
import { checkTypeConflicts } from './check-type-conflicts.ts'
export function mergeNumberConstraints(
  first: OpenAPIV3.SchemaObject,
  second: OpenAPIV3.SchemaObject,
  getRef: GetRefFn
): OpenAPIV3.SchemaObject {
  checkTypeConflicts(first, second)

  // First merge enum values if present
  const result: SchemaObject = genericMerge(first, second, getRef, v.number())

  // Then merge other constraints
  result.type = 'number'

  // Merge minimum and exclusiveMinimum
  if (first.minimum !== undefined || second.minimum !== undefined) {
    const minA = first.minimum ?? -Infinity
    const minB = second.minimum ?? -Infinity
    result.minimum = Math.max(minA, minB)

    // If either minimum is exclusive, the result is exclusive
    if (first.exclusiveMinimum || second.exclusiveMinimum) {
      result.exclusiveMinimum = true
    }
  }

  // Merge maximum and exclusiveMaximum
  if (first.maximum !== undefined || second.maximum !== undefined) {
    const maxA = first.maximum ?? Infinity
    const maxB = second.maximum ?? Infinity
    result.maximum = Math.min(maxA, maxB)

    // If either maximum is exclusive, the result is exclusive
    if (first.exclusiveMaximum || second.exclusiveMaximum) {
      result.exclusiveMaximum = true
    }
  }

  // Merge multipleOf
  if (first.multipleOf !== undefined && second.multipleOf !== undefined) {
    result.multipleOf = first.multipleOf * second.multipleOf
  } else if (first.multipleOf !== undefined) {
    result.multipleOf = first.multipleOf
  } else if (second.multipleOf !== undefined) {
    result.multipleOf = second.multipleOf
  }

  return result
}
