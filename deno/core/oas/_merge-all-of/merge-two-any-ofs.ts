import type { OpenAPIV3 } from 'openapi-types'
import type { AnyOfObject, GetRefFn } from './types.ts'
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

// This function receives two anyOf schemas and returns their common elements aka intersection
export const mergeTwoAnyOfs = (a: AnyOfObject, b: AnyOfObject, getRef: GetRefFn): AnyOfObject => {
  // Handle case where both schemas don't have anyOf
  if (!a.anyOf && !b.anyOf) {
    const typeA = a.type
    const typeB = b.type
    if (!typeA || !typeB || typeA !== typeB) {
      throw new Error(`Cannot merge schemas: conflicting types "${typeA}" and "${typeB}"`)
    }
    return mergeTwoSchemas(a, b, getRef)
  }

  // Handle case where one schema doesn't have anyOf
  if (!a.anyOf || !b.anyOf) {
    const schemaWithanyOf = a.anyOf ? a : b
    const otherSchema = a.anyOf ? b : a
    const otherType = otherSchema.type

    if (!otherType) {
      throw new Error('Schema has no type')
    }

    if (!schemaWithanyOf.anyOf) {
      throw new Error('Schema anyOf is undefined')
    }

    // Try to find a matching type in the anyOf array
    const matchingSchema = schemaWithanyOf.anyOf.find(schema => {
      try {
        return getSchemaType(schema, getRef) === otherType
      } catch {
        return false
      }
    })

    if (!matchingSchema) {
      const firstType = getSchemaType(schemaWithanyOf.anyOf[0], getRef)
      throw new Error(`Cannot merge schemas: conflicting types "${firstType}" and "${otherType}"`)
    }

    return mergeTwoSchemas(
      otherSchema,
      isRef(matchingSchema) ? getRef(matchingSchema) : matchingSchema,
      getRef
    )
  }

  // Find matching schemas between the two anyOf arrays
  for (const schemaA of a.anyOf) {
    for (const schemaB of b.anyOf) {
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
  const typeA = getSchemaType(a.anyOf[0], getRef)
  const typeB = getSchemaType(b.anyOf[0], getRef)
  throw new Error(`Cannot merge schemas: conflicting types "${typeA}" and "${typeB}"`)
}
