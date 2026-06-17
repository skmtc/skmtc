import type { OpenAPIV3 } from 'openapi-types'

export const checkNumberConstraintsConflicts = (
  a: OpenAPIV3.SchemaObject,
  b: OpenAPIV3.SchemaObject
): void => {
  if (a.type === 'number' && b.type === 'number') {
    const aMin = a.minimum ?? -Infinity
    const aMax = a.maximum ?? Infinity
    const bMin = b.minimum ?? -Infinity
    const bMax = b.maximum ?? Infinity
    if (aMin > bMax || bMin > aMax) {
      throw new Error(
        `Cannot merge schemas: incompatible number ranges [${aMin},${aMax}] and [${bMin},${bMax}]`
      )
    }
  }
}
