import type { OpenAPIV3 } from 'openapi-types'

export const mergeMetadata = (
  a: OpenAPIV3.SchemaObject,
  b: OpenAPIV3.SchemaObject
): Partial<OpenAPIV3.SchemaObject> => {
  const result: Partial<OpenAPIV3.SchemaObject> = {}

  // Only include properties that are defined in either schema
  if (b.title !== undefined || a.title !== undefined) {
    result.title = b.title !== undefined ? b.title : a.title
  }
  if (b.description !== undefined || a.description !== undefined) {
    result.description = b.description !== undefined ? b.description : a.description
  }
  if (b.default !== undefined || a.default !== undefined) {
    result.default = b.default !== undefined ? b.default : a.default
  }
  if (b.example !== undefined || a.example !== undefined) {
    result.example = b.example !== undefined ? b.example : a.example
  }
  if (b.externalDocs !== undefined || a.externalDocs !== undefined) {
    result.externalDocs = b.externalDocs !== undefined ? b.externalDocs : a.externalDocs
  }
  if (b.deprecated !== undefined || a.deprecated !== undefined) {
    result.deprecated = b.deprecated !== undefined ? b.deprecated : a.deprecated
  }
  if (b.nullable !== undefined || a.nullable !== undefined) {
    result.nullable = b.nullable !== undefined ? b.nullable : a.nullable
  }
  if (b.readOnly !== undefined || a.readOnly !== undefined) {
    result.readOnly = b.readOnly !== undefined ? b.readOnly : a.readOnly
  }
  if (b.writeOnly !== undefined || a.writeOnly !== undefined) {
    result.writeOnly = b.writeOnly !== undefined ? b.writeOnly : a.writeOnly
  }

  return result
}
