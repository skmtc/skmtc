import type { OpenAPIV3 } from 'openapi-types'
import { genericMerge } from './generic-merge.ts'
import type { GetRefFn } from './types.ts'
import * as v from 'valibot'
export function mergeBooleanConstraints(
  first: OpenAPIV3.SchemaObject,
  second: OpenAPIV3.SchemaObject,
  getRef: GetRefFn
): OpenAPIV3.SchemaObject {
  // If neither schema has a type, return empty object
  if (!first.type && !second.type) {
    return {}
  }

  // Check for type conflicts
  if (first.type && second.type && first.type !== second.type) {
    throw new Error(`Cannot merge schemas: conflicting types '${first.type}' and '${second.type}'`)
  }

  // If only one schema has a type and it's not boolean, return empty object
  if ((first.type && first.type !== 'boolean') || (second.type && second.type !== 'boolean')) {
    return {}
  }

  return genericMerge(first, second, getRef, v.boolean())
}
