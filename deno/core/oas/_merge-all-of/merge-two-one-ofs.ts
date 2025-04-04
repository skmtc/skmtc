import type { OpenAPIV3 } from 'openapi-types'
import type { OneOfObject, GetRefFn } from './types.ts'
import { mergeTwoSchemas } from './merge-two-schemas.ts'
import { mergeMetadata } from './merge-metadata.ts'

// Helper function to check if a schema is a reference
const isRef = (
  schema: OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject
): schema is OpenAPIV3.ReferenceObject => {
  return '$ref' in schema
}

// Helper function to get the type of a schema, resolving references if needed
const getSchemaType = (
  schema: OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject,
  getRef: GetRefFn
): string => {
  if (isRef(schema)) {
    const resolved = getRef(schema)
    if (!resolved.type) {
      throw new Error('Resolved schema has no type')
    }
    return resolved.type
  }
  if (!schema.type) {
    throw new Error('Schema has no type')
  }
  return schema.type
}

// This function receives two oneOf schemas and returns their common elements aka intersection
export const mergeTwoOneOfs = (a: OneOfObject, b: OneOfObject, getRef: GetRefFn): OneOfObject => {
  // Handle case where both schemas don't have oneOf
  if (!a.oneOf && !b.oneOf) {
    const typeA = a.type
    const typeB = b.type
    if (!typeA || !typeB || typeA !== typeB) {
      throw new Error(`Cannot merge schemas: conflicting types "${typeA}" and "${typeB}"`)
    }
    return mergeTwoSchemas(a, b, getRef)
  }

  // Handle case where one schema doesn't have oneOf
  if (!a.oneOf || !b.oneOf) {
    const schemaWithOneOf = a.oneOf ? a : b
    const otherSchema = a.oneOf ? b : a
    const otherType = otherSchema.type

    if (!otherType) {
      throw new Error('Schema has no type')
    }

    if (!schemaWithOneOf.oneOf) {
      throw new Error('Schema oneOf is undefined')
    }

    // Try to find a matching type in the oneOf array
    const matchingSchema = schemaWithOneOf.oneOf.find(schema => {
      try {
        return getSchemaType(schema, getRef) === otherType
      } catch {
        return false
      }
    })

    if (!matchingSchema) {
      const firstType = getSchemaType(schemaWithOneOf.oneOf[0], getRef)
      throw new Error(`Cannot merge schemas: conflicting types "${firstType}" and "${otherType}"`)
    }

    return mergeTwoSchemas(
      otherSchema,
      isRef(matchingSchema) ? getRef(matchingSchema) : matchingSchema,
      getRef
    )
  }

  // Find matching schemas between the two oneOf arrays
  for (const schemaA of a.oneOf) {
    for (const schemaB of b.oneOf) {
      try {
        const typeA = getSchemaType(schemaA, getRef)
        const typeB = getSchemaType(schemaB, getRef)

        if (typeA === typeB) {
          // Found a match, merge these schemas
          return mergeTwoSchemas(
            isRef(schemaA) ? getRef(schemaA) : schemaA,
            isRef(schemaB) ? getRef(schemaB) : schemaB,
            getRef
          )
        }
      } catch {
        // Skip if reference resolution fails
        continue
      }
    }
  }

  // If we get here, no matching types were found
  const typeA = getSchemaType(a.oneOf[0], getRef)
  const typeB = getSchemaType(b.oneOf[0], getRef)
  throw new Error(`Cannot merge schemas: conflicting types "${typeA}" and "${typeB}"`)
}
