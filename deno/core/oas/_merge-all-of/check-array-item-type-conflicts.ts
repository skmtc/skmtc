import type { OpenAPIV3 } from 'openapi-types'

export const checkArrayItemTypeConflicts = (
  a: OpenAPIV3.SchemaObject,
  b: OpenAPIV3.SchemaObject
): void => {
  if (a.type === 'array' && b.type === 'array' && 'items' in a && 'items' in b) {
    const aItems = a.items as OpenAPIV3.SchemaObject
    const bItems = b.items as OpenAPIV3.SchemaObject
    if (aItems.type && bItems.type && aItems.type !== bItems.type) {
      throw new Error(
        `Cannot merge schemas: array items have conflicting types '${aItems.type}' and '${bItems.type}'`
      )
    }
  }
}
