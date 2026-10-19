import { assert } from '@std/assert'
import type { OpenAPIV3 } from 'openapi-types'

const isDocumentObject = (value: unknown): value is OpenAPIV3.Document =>
  typeof value === 'object' && value !== null && 'openapi' in value && 'info' in value

/** Narrow a parsed JSON or YAML value to an OpenAPI document object. */
export const toDocumentObject = (value: unknown, name: string): OpenAPIV3.Document => {
  assert(isDocumentObject(value), `${name} is not an OpenAPI document`)
  return value
}
