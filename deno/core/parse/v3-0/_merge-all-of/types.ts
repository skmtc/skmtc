import type { OpenAPIV3 } from 'openapi-types'
import * as v from 'valibot'
import type { ParseGetRefFn, RefRole } from '@/helpers/toParseGetRef.ts'
export type { RefRole }

/**
 * Resolves a `$ref` for the merge layer. `role` says how the result is about
 * to be used; the optional members keep the parse's cycle record current.
 * Plain document lookups (and test doubles) provide the call alone.
 */
export type GetRefFn = ParseGetRefFn

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
