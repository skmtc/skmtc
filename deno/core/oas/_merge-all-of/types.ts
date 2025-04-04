import type { OpenAPIV3 } from 'openapi-types'
export type GetRefFn = (ref: OpenAPIV3.ReferenceObject) => OpenAPIV3.SchemaObject

export type OneOfObject = {
  oneOf?: (OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject)[]
} & OpenAPIV3.SchemaObject

export type AnyOfObject = {
  anyOf?: (OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject)[]
} & OpenAPIV3.SchemaObject
