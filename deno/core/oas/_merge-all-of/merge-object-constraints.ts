import type { OpenAPIV3 } from 'openapi-types'
import { mergeEnumValues } from './merge-enum-values.ts'
import { mergeTwoSchemas } from './merge-two-schemas.ts'
import { isRef } from '../../helpers/refFns.ts'
import type { OneOfObject, AnyOfObject } from './types.ts'
import { mergeTwoOneOfs } from './merge-two-one-ofs.ts'
import { mergeTwoAnyOfs } from './merge-two-any-ofs.ts'
type SchemaObject = OpenAPIV3.SchemaObject
type ReferenceObject = OpenAPIV3.ReferenceObject
type SchemaOrReference = SchemaObject | ReferenceObject

const isOneOf = (schema: unknown): schema is OneOfObject => {
  return (
    typeof schema === 'object' &&
    schema !== null &&
    'oneOf' in schema &&
    Array.isArray(schema.oneOf)
  )
}

const isAnyOf = (schema: unknown): schema is AnyOfObject => {
  return (
    typeof schema === 'object' &&
    schema !== null &&
    'anyOf' in schema &&
    Array.isArray(schema.anyOf)
  )
}

export const mergeObjectConstraints = (
  a: SchemaObject,
  b: SchemaObject,
  getRef: (ref: ReferenceObject) => SchemaObject
): SchemaObject => {
  // Check for type conflicts
  if (a.type && b.type && a.type !== b.type) {
    throw new Error(`Cannot merge schemas: conflicting types '${a.type}' and '${b.type}'`)
  }

  // If only one schema has a type and it's not object, return empty object
  if ((a.type && a.type !== 'object') || (b.type && b.type !== 'object')) {
    return {}
  }

  const result: SchemaObject = {}
  result.type = 'object'

  // Merge properties, using mergeTwoSchemas for properties that exist in both schemas
  const properties: Record<string, SchemaOrReference> = {}

  // First add all properties from the second schema
  if (b.properties) {
    Object.assign(properties, b.properties)
  }

  // Then merge properties from the first schema
  if (a.properties) {
    for (const [key, value] of Object.entries(a.properties)) {
      if (properties[key]) {
        // If property exists in both schemas and both are the same schema
        if (isRef(value) && isRef(properties[key]) && value.$ref === properties[key].$ref) {
          // take the second schema's property by doing nothing
          // If both are oneOf, merge them
        } else if (isOneOf(value) && isOneOf(properties[key])) {
          properties[key] = mergeTwoOneOfs(value, properties[key], getRef)
        } else if (isAnyOf(value) && isAnyOf(properties[key])) {
          properties[key] = mergeTwoAnyOfs(value, properties[key], getRef)
        } else {
          // If property exists in both schemas and both are SchemaObjects, merge them
          properties[key] = mergeTwoSchemas(
            isRef(value) ? getRef(value) : value,
            isRef(properties[key]) ? getRef(properties[key]) : properties[key],
            getRef
          )
        }
      } else {
        // If property only exists in first schema, add it
        properties[key] = value
      }
    }
  }

  if (Object.keys(properties).length > 0) {
    result.properties = properties
  }

  // Merge required properties
  const required = new Set<string>()
  if (a.required) {
    a.required.forEach(prop => required.add(prop))
  }
  if (b.required) {
    b.required.forEach(prop => required.add(prop))
  }
  if (required.size > 0) {
    result.required = Array.from(required)
  }

  // Merge additionalProperties
  if (typeof b.additionalProperties === 'object' && typeof a.additionalProperties === 'object') {
    // If both have additionalProperties as schemas, take the first one
    result.additionalProperties = a.additionalProperties
  } else if (b.additionalProperties !== undefined) {
    result.additionalProperties = b.additionalProperties
  } else if (a.additionalProperties !== undefined) {
    result.additionalProperties = a.additionalProperties
  }

  // Merge minProperties and maxProperties
  if (b.minProperties !== undefined || a.minProperties !== undefined) {
    result.minProperties = Math.max(b.minProperties ?? 0, a.minProperties ?? 0)
  }
  if (b.maxProperties !== undefined || a.maxProperties !== undefined) {
    result.maxProperties = Math.min(b.maxProperties ?? Infinity, a.maxProperties ?? Infinity)
  }

  // Merge enum values if present
  if (a.enum || b.enum) {
    Object.assign(result, mergeEnumValues(a, b))
  }

  return result
}
