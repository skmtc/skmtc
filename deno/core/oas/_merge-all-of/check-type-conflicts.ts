import type { OpenAPIV3 } from 'openapi-types'

export const checkTypeConflicts = (a: OpenAPIV3.SchemaObject, b: OpenAPIV3.SchemaObject): void => {
  if (a.type && b.type && a.type !== b.type) {
    throw new Error(`Cannot merge schemas: conflicting types '${a.type}' and '${b.type}'`)
  }
}
