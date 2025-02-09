import type { OpenAPIV3 } from 'openapi-types'

export type SchemaItem = {
  schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject
  name: string
  type: 'list-item' | 'form-item'
}
