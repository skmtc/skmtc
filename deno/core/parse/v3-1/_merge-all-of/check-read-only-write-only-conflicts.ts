import type { OpenAPIV3 } from 'openapi-types'

export const checkReadOnlyWriteOnlyConflicts = (
  a: OpenAPIV3.SchemaObject,
  b: OpenAPIV3.SchemaObject
): void => {
  if ((a.readOnly && b.writeOnly) || (a.writeOnly && b.readOnly)) {
    throw new Error('Cannot merge schemas: property cannot be both readOnly and writeOnly')
  }
}
