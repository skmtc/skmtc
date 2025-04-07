import type { OpenAPIV3 } from 'openapi-types'
import { mergeSchemasOrRefs } from './merge.ts'
import { genericMerge } from './generic-merge.ts'
import * as v from 'valibot'
import { checkTypeConflicts } from './check-type-conflicts.ts'
type SchemaObject = OpenAPIV3.SchemaObject
type ReferenceObject = OpenAPIV3.ReferenceObject

export const mergeObjectConstraints = (
  first: SchemaObject,
  second: SchemaObject,
  getRef: (ref: ReferenceObject) => SchemaObject
): SchemaObject => {
  // Check for type conflicts
  checkTypeConflicts(first, second)

  // // If only one schema has a type and it's not object, return empty object
  // if ((a.type && a.type !== 'object') || (b.type && b.type !== 'object')) {
  //   return {}
  // }

  // const result: SchemaObject = {}
  // result.type = 'object'

  // // Merge properties, using mergeTwoSchemas for properties that exist in both schemas
  // const properties: Record<string, SchemaOrReference> = {}

  // // First add all properties from the second schema
  // if (b.properties) {
  //   Object.assign(properties, b.properties)
  // }

  // Then merge properties from the first schema
  // if (a.properties) {
  //   for (const [key, value] of Object.entries(a.properties)) {
  //     if (properties[key]) {
  //       // If property exists in both schemas and both are the same schema
  //       if (isRef(value) && isRef(properties[key]) && value.$ref === properties[key].$ref) {
  //         // take the second schema's property by doing nothing
  //         // If both are oneOf, merge them
  //       } else if (isOneOf(value) && isOneOf(properties[key])) {
  //         properties[key] = mergeSchemasOrRefs(value, properties[key], getRef)
  //       } else if (isAnyOf(value) && isAnyOf(properties[key])) {
  //         properties[key] = mergeTwoAnyOfs(value, properties[key], getRef)
  //       } else {
  //         // If property exists in both schemas and both are SchemaObjects, merge them
  //         properties[key] = mergeTwoSchemas(
  //           isRef(value) ? getRef(value) : value,
  //           isRef(properties[key]) ? getRef(properties[key]) : properties[key],
  //           getRef
  //         )
  //       }
  //     } else {
  //       // If property only exists in first schema, add it
  //       properties[key] = value
  //     }
  //   }
  // }

  // if (Object.keys(properties).length > 0) {
  //   result.properties = properties
  // }

  const result: SchemaObject = genericMerge(first, second, getRef, v.record(v.string(), v.any()))

  // Merge additionalProperties
  if (
    typeof second.additionalProperties === 'object' &&
    typeof first.additionalProperties === 'object'
  ) {
    // If both have additionalProperties as schemas, merge them
    result.additionalProperties = mergeSchemasOrRefs(
      first.additionalProperties,
      second.additionalProperties,
      getRef
    )
  } else if (second.additionalProperties !== undefined) {
    result.additionalProperties = second.additionalProperties
  } else if (first.additionalProperties !== undefined) {
    result.additionalProperties = first.additionalProperties
  }

  // Merge minProperties and maxProperties
  if (second.minProperties !== undefined || first.minProperties !== undefined) {
    result.minProperties = Math.max(second.minProperties ?? 0, first.minProperties ?? 0)
  }

  if (second.maxProperties !== undefined || first.maxProperties !== undefined) {
    result.maxProperties = Math.min(
      second.maxProperties ?? Infinity,
      first.maxProperties ?? Infinity
    )
  }

  return result
}
