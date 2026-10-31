import type { OpenAPIV3 } from 'openapi-types'
import type { SchemaObject } from './types.ts'
import { genericMerge } from './generic-merge.ts'
import type { GetRefFn, NormalizeFn } from './types.ts'
import * as v from 'valibot'
import { checkTypeConflicts } from './check-type-conflicts.ts'
import { mergeBounds } from '@/parse/v3-1/_merge-all-of/merge-bounds.ts'
export function mergeIntegerConstraints(
  first: OpenAPIV3.SchemaObject,
  second: OpenAPIV3.SchemaObject,
  getRef: GetRefFn,
  normalize: NormalizeFn
): OpenAPIV3.SchemaObject {
  checkTypeConflicts(first, second)

  // First merge enum values if present
  const result: SchemaObject = genericMerge(first, second, getRef, normalize, v.number())

  // Then merge other constraints
  result.type = 'integer'

  mergeBounds(result, first, second)

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
