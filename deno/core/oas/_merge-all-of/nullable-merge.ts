import type { OpenAPIV3 } from 'openapi-types'
import { isEmpty } from '../../helpers/isEmpty.ts'

export const mergeNullOnly = (schema: OpenAPIV3.SchemaObject): OpenAPIV3.SchemaObject => {
  if (schema.enum && !schema.enum.includes(null)) {
    schema.enum.push(null)
  }

  schema.nullable = true

  return schema
}

export const isNullOnly = (schema: OpenAPIV3.SchemaObject): boolean => {
  const { type: _type, nullable, enum: enumValues, ...rest } = schema

  return (
    Boolean(nullable) && enumValues?.length === 1 && enumValues[0] === null && isEmpty(rest ?? {})
  )
}
