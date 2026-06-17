import type { OpenAPIV3 } from 'openapi-types'
import * as v from 'valibot'
export type GetRefFn = (ref: OpenAPIV3.ReferenceObject) => OpenAPIV3.SchemaObject

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
