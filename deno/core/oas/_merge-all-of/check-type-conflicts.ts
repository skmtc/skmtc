import type { OpenAPIV3 } from 'openapi-types'

export const checkTypeConflicts = (
  first: OpenAPIV3.SchemaObject,
  second: OpenAPIV3.SchemaObject
): void => {
  if (first.type && second.type && first.type !== second.type) {
    throw new Error(`Cannot merge schemas: conflicting types '${first.type}' and '${second.type}'`)
  }
}
