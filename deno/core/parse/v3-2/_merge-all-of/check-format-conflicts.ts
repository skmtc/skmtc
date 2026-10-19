import type { OpenAPIV3 } from 'openapi-types'

export const checkFormatConflicts = (
  a: OpenAPIV3.SchemaObject,
  b: OpenAPIV3.SchemaObject
): void => {
  if (a.format && b.format && a.format !== b.format) {
    throw new Error(`Cannot merge schemas: conflicting formats '${a.format}' and '${b.format}'`)
  }
}
