import type { OpenAPIV3 } from 'openapi-types'
import { isEmpty } from '@/helpers/isEmpty.ts'

/**
 * `schema`, nullable: a copy, as `schema` may be a component that other
 * references share (a target followed through its reference).
 */
export const mergeNullOnly = (schema: OpenAPIV3.SchemaObject): OpenAPIV3.SchemaObject => ({
  ...schema,
  ...(schema.enum && !schema.enum.includes(null) ? { enum: [...schema.enum, null] } : {}),
  nullable: true
})

export const isNullOnly = (schema: OpenAPIV3.SchemaObject): boolean => {
  const { type: _type, nullable, enum: enumValues, ...rest } = schema

  return (
    Boolean(nullable) && enumValues?.length === 1 && enumValues[0] === null && isEmpty(rest ?? {})
  )
}
