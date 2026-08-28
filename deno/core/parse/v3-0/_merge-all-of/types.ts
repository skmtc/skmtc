import type { OpenAPIV3 } from 'openapi-types'
import * as v from 'valibot'
import type { RefRole } from '@/helpers/toParseGetRef.ts'
export type { RefRole }

/**
 * Resolves a `$ref` for the merge layer. `role` says how the result is about
 * to be used; `'base'` (an `allOf` member being copied in) is the only role
 * a cycle-aware resolver guards. Plain document lookups ignore it.
 */
export type GetRefFn = (ref: OpenAPIV3.ReferenceObject, role?: RefRole) => OpenAPIV3.SchemaObject

export type OneOfObject = {
  oneOf?: (OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject)[]
} & OpenAPIV3.SchemaObject

export type AnyOfObject = {
  anyOf?: (OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject)[]
} & OpenAPIV3.SchemaObject

export type SchemaObject = OpenAPIV3.SchemaObject
export type ReferenceObject = OpenAPIV3.ReferenceObject
export type SchemaOrReference = SchemaObject | ReferenceObject

export type ArraySchemaObject = OpenAPIV3.ArraySchemaObject

export const IntegerSchema = v.pipe(v.number(), v.integer('The number must be an integer.'))
