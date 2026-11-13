import type { OpenAPIV3 } from 'openapi-types'
import { genericMerge } from './generic-merge.ts'
import type { MergeArgs } from './types.ts'
import * as v from 'valibot'
import { checkTypeConflicts } from './check-type-conflicts.ts'
export function mergeBooleanConstraints({ first, second, getRef, normalize, system }: MergeArgs<OpenAPIV3.SchemaObject>): OpenAPIV3.SchemaObject {
  checkTypeConflicts(first, second)

  return genericMerge({ first, second, getRef, normalize, system, typeCheck: v.boolean() })
}
