import type { OpenAPIV3 } from 'openapi-types'
import { isEqual } from './is-equal.ts'
export const checkEnumConflicts = (
  first: OpenAPIV3.SchemaObject,
  second: OpenAPIV3.SchemaObject
): void => {
  if (first.enum && second.enum) {
    const intersection = first.enum.filter(value => {
      return second.enum!.some(bValue => isEqual(value, bValue))
    })

    if (intersection.length === 0) {
      throw new Error(
        `Cannot merge schemas: enum values have no intersection. First: ${first.enum}, Second: ${second.enum}`
      )
    }
  }
}
