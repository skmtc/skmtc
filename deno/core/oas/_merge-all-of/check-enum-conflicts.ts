import type { OpenAPIV3 } from 'openapi-types'

export const checkEnumConflicts = (a: OpenAPIV3.SchemaObject, b: OpenAPIV3.SchemaObject): void => {
  if (a.enum && b.enum) {
    const intersection = a.enum.filter(x => b.enum!.includes(x))
    if (intersection.length === 0) {
      throw new Error('Cannot merge schemas: enum values have no intersection')
    }
  }
}
