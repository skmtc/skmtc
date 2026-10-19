import type { OpenAPIV3 } from 'openapi-types'
import type { SchemaObject } from './types.ts'
import { genericMerge } from './generic-merge.ts'
import type { GetRefFn } from './types.ts'
import * as v from 'valibot'
import { checkTypeConflicts } from './check-type-conflicts.ts'
import { checkAtLeastOneTypeMatch } from './check-at-least-one-type-match.ts'
export function mergeStringConstraints(
  first: OpenAPIV3.SchemaObject,
  second: OpenAPIV3.SchemaObject,
  getRef: GetRefFn
): OpenAPIV3.SchemaObject {
  checkTypeConflicts(first, second)

  if (!checkAtLeastOneTypeMatch(first, second, 'string')) {
    return genericMerge(first, second, getRef)
  }

  // First merge enum values if present
  const result: SchemaObject = genericMerge(first, second, getRef, v.string())

  // Then merge other constraints
  result.type = 'string'

  // Merge minLength
  if (first.minLength !== undefined || second.minLength !== undefined) {
    const minA = first.minLength ?? 0
    const minB = second.minLength ?? 0
    result.minLength = Math.max(minA, minB)
  }

  // Merge maxLength
  if (first.maxLength !== undefined || second.maxLength !== undefined) {
    const maxA = first.maxLength ?? Infinity
    const maxB = second.maxLength ?? Infinity
    result.maxLength = Math.min(maxA, maxB)
  }

  // Merge pattern
  if (first.pattern !== undefined && second.pattern !== undefined) {
    // If both have patterns, they must match
    if (first.pattern !== second.pattern) {
      throw new Error(
        `Cannot merge schemas: conflicting patterns '${first.pattern}' and '${second.pattern}'`
      )
    }
    result.pattern = first.pattern
  } else if (first.pattern !== undefined) {
    result.pattern = first.pattern
  } else if (second.pattern !== undefined) {
    result.pattern = second.pattern
  }

  // Merge format
  if (first.format !== undefined && second.format !== undefined) {
    // If both have formats, they must match
    if (first.format !== second.format) {
      throw new Error('Incompatible string formats')
    }
    result.format = first.format
  } else if (first.format !== undefined) {
    result.format = first.format
  } else if (second.format !== undefined) {
    result.format = second.format
  }

  return result
}
