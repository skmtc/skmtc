import { checkTypeConflicts } from './check-type-conflicts.ts'
import { checkReadOnlyWriteOnlyConflicts } from './check-read-only-write-only-conflicts.ts'
import { checkFormatConflicts } from './check-format-conflicts.ts'
import { checkEnumConflicts } from './check-enum-conflicts.ts'
import { checkNumberConstraintsConflicts } from './check-number-constraints-conflicts.ts'
import { checkArrayItemTypeConflicts } from './check-array-item-type-conflicts.ts'
import { mergeNumberConstraints } from './merge-number-constraints.ts'
import { mergeStringConstraints } from './merge-string-constraints.ts'
import { mergeArrayConstraints } from './merge-array-constraints.ts'
import { mergeObjectConstraints } from './merge-object-constraints.ts'
import { mergeEnumValues } from './merge-enum-values.ts'
import { mergeMetadata } from './merge-metadata.ts'
import { mergeIntegerConstraints } from './merge-integer-constraints.ts'
import { mergeBooleanConstraints } from './merge-boolean-constraints.ts'
import type { OpenAPIV3 } from 'openapi-types'
import type { GetRefFn } from './types.ts'
type NonArraySchemaObject = OpenAPIV3.NonArraySchemaObject
type ArraySchemaObject = OpenAPIV3.ArraySchemaObject
type SchemaObject = OpenAPIV3.SchemaObject

export const mergeTwoSchemas = (
  first: SchemaObject,
  second: SchemaObject,
  getRef: GetRefFn
): SchemaObject => {
  throw new Error('Start here')
  // CONTINUE HERE NEXT
  // 1. Is of the schemas a oneOf?
  // -> try to merge each oneOf member with the other schema
  // -> The parent of all pairs is a oneOf
  // 2. Are both schemas a oneOf?
  // -> If yes, attempt to  merge each item from one set with one from the other set
  // -> The parent of all pairs is a oneOf
  // Use above to replace mergeTwoOneOfs and mergeTwoAnyOfs <- key

  // 1. Check for critical conflicts that should prevent merging
  checkTypeConflicts(first, second)
  checkReadOnlyWriteOnlyConflicts(first, second)
  checkFormatConflicts(first, second)
  checkEnumConflicts(first, second)
  checkNumberConstraintsConflicts(first, second)
  checkArrayItemTypeConflicts(first, second)

  // 2. Check for 'not' keyword in either schema
  if (first.not || second.not) {
    throw new Error('Merging schemas with "not" keyword is not supported')
  }

  // 3. Start with an empty result object
  const result: SchemaObject = {}

  // 4. Merge metadata fields first
  Object.assign(result, mergeMetadata(first, second))

  // 5. Handle type-specific merging based on the type of the second schema
  if (second.type) {
    if (second.type === 'array') {
      Object.assign(result, mergeArrayConstraints(first, second))
    } else {
      switch (second.type) {
        case 'integer':
          Object.assign(result, mergeIntegerConstraints(first, second))
          break
        case 'number':
          Object.assign(result, mergeNumberConstraints(first, second))
          break
        case 'string':
          Object.assign(result, mergeStringConstraints(first, second))
          break
        case 'object':
          Object.assign(result, mergeObjectConstraints(first, second, getRef))
          break
        case 'boolean':
          Object.assign(result, mergeBooleanConstraints(first, second))
          break
      }
    }
  } else if (first.type) {
    // If second schema has no type, use first schema's type
    if (first.type === 'array') {
      Object.assign(result, mergeArrayConstraints(first, second))
    } else {
      ;(result as NonArraySchemaObject).type = first.type
    }
  }

  // 6. Handle enum values
  if (first.enum || second.enum) {
    Object.assign(result, mergeEnumValues(first, second))
  }

  // 7. Handle additional properties for object types
  if (result.type === 'object') {
    const resultObj = result as NonArraySchemaObject
    const firstObj = first as NonArraySchemaObject
    const secondObj = second as NonArraySchemaObject

    // Merge additionalProperties
    if (secondObj.additionalProperties !== undefined) {
      resultObj.additionalProperties = secondObj.additionalProperties
    } else if (firstObj.additionalProperties !== undefined) {
      resultObj.additionalProperties = firstObj.additionalProperties
    }

    // Merge patternProperties
    const firstPatternProps = (firstObj as any).patternProperties
    const secondPatternProps = (secondObj as any).patternProperties
    if (secondPatternProps || firstPatternProps) {
      ;(resultObj as any).patternProperties = {
        ...(firstPatternProps || {}),
        ...(secondPatternProps || {})
      }
    }
  }

  // 8. Handle required fields for object types
  if (result.type === 'object' && (first.required || second.required)) {
    const resultObj = result as NonArraySchemaObject
    const firstObj = first as NonArraySchemaObject
    const secondObj = second as NonArraySchemaObject

    const required = new Set<string>()
    if (firstObj.required) {
      firstObj.required.forEach(prop => required.add(prop))
    }
    if (secondObj.required) {
      secondObj.required.forEach(prop => required.add(prop))
    }
    resultObj.required = Array.from(required)
  }

  // // 9. Handle oneOf/anyOf/allOf keywords
  // if (first.oneOf || second.oneOf) {
  //   result.oneOf = [...(first.oneOf || []), ...(second.oneOf || [])]
  // }
  // if (first.anyOf || second.anyOf) {
  //   result.anyOf = [...(first.anyOf || []), ...(second.anyOf || [])]
  // }
  // if (first.allOf || second.allOf) {
  //   result.allOf = [...(first.allOf || []), ...(second.allOf || [])]
  // }

  // 10. Return the merged schema
  return result
}
