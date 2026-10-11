import type { OpenAPIV3 } from 'openapi-types'
import { isEmpty } from '@/helpers/isEmpty.ts'

/**
 * Returns a NEW schema. `getRef` hands back the live
 * `components.schemas[X]` object, so mutating here rewrote the shared
 * component for every other use site and made the result depend on parse
 * order. A shallow copy at the call site is not enough on its own — `enum`
 * is an array, and pushing into it reaches the original through the copied
 * reference — so the copy has to happen here, where the array is replaced
 * rather than appended to.
 */
export const mergeNullOnly = (schema: OpenAPIV3.SchemaObject): OpenAPIV3.SchemaObject => {
  const merged: OpenAPIV3.SchemaObject = { ...schema, nullable: true }

  if (schema.enum && !schema.enum.includes(null)) {
    merged.enum = [...schema.enum, null]
  }

  return merged
}

export const isNullOnly = (schema: OpenAPIV3.SchemaObject): boolean => {
  const { type: _type, nullable, enum: enumValues, ...rest } = schema

  return (
    Boolean(nullable) && enumValues?.length === 1 && enumValues[0] === null && isEmpty(rest ?? {})
  )
}
