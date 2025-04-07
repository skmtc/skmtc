import type { OpenAPIV3 } from 'openapi-types'
import { genericMerge } from './generic-merge.ts'
import type { GetRefFn } from './types.ts'
import * as v from 'valibot'
import { checkTypeConflicts } from './check-type-conflicts.ts'
export function mergeBooleanConstraints(
  first: OpenAPIV3.SchemaObject,
  second: OpenAPIV3.SchemaObject,
  getRef: GetRefFn
): OpenAPIV3.SchemaObject {
  checkTypeConflicts(first, second)

  return genericMerge(first, second, getRef, v.boolean())
}
