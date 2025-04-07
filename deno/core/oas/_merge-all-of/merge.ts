import { isRef } from '../../helpers/refFns.ts'
import { isEmpty } from 'lodash-es'
import type { SchemaOrReference, ReferenceObject, SchemaObject, GetRefFn } from './types.ts'
import { checkTypeConflicts } from './check-type-conflicts.ts'
import { checkReadOnlyWriteOnlyConflicts } from './check-read-only-write-only-conflicts.ts'
import { checkFormatConflicts } from './check-format-conflicts.ts'
import { checkEnumConflicts } from './check-enum-conflicts.ts'
import { checkNumberConstraintsConflicts } from './check-number-constraints-conflicts.ts'
import { checkArrayItemTypeConflicts } from './check-array-item-type-conflicts.ts'

import { mergeObjectConstraints } from './merge-object-constraints.ts'
import { mergeArrayConstraints } from './merge-array-constraints.ts'
import { mergeStringConstraints } from './merge-string-constraints.ts'
import { mergeNumberConstraints } from './merge-number-constraints.ts'
import { mergeIntegerConstraints } from './merge-integer-constraints.ts'
import { mergeBooleanConstraints } from './merge-boolean-constraints.ts'
import { genericMerge } from './generic-merge.ts'
export const mergeSchemasOrRefs = (
  first: SchemaOrReference,
  second: SchemaOrReference,
  getRef: GetRefFn
): SchemaOrReference => {
  if (containsRef(first, second)) {
    return mergeWithRef(first, second, getRef)
  }

  if (isRef(first)) {
    throw new Error('Ref in first')
  }

  if (isRef(second)) {
    throw new Error('Ref in second')
  }

  if (containsOneOf(first, second)) {
    return mergeSchemasWithOneOfs(first, second, getRef)
  }

  if (containsAnyOf(first, second)) {
    return mergeSchemasWithAnyOfs(first, second, getRef)
  }

  return mergeSchemas(first, second, getRef)
}

const containsAnyOf = (first: SchemaObject, second: SchemaObject): boolean => {
  if (first.anyOf) {
    if (first.anyOf?.length) {
      return true
    }

    throw new Error('Empty anyOf')
  }

  if (second.anyOf) {
    if (second.anyOf?.length) {
      return true
    }

    throw new Error('Empty anyOf')
  }

  return false
}

const mergeSchemasWithAnyOfs = (
  first: SchemaObject,
  second: SchemaObject,
  getRef: (ref: ReferenceObject) => SchemaObject
): SchemaObject => {
  const firstAnyOf = Array.isArray(first.anyOf) ? first.anyOf : [first]
  const secondAnyOf = Array.isArray(second.anyOf) ? second.anyOf : [second]

  const mergedAnyOf = crossProduct(firstAnyOf, secondAnyOf).map(([firstItem, secondItem]) => {
    return mergeSchemasOrRefs(firstItem, secondItem, getRef)
  })

  return {
    anyOf: mergedAnyOf
  }
}

const containsOneOf = (first: SchemaObject, second: SchemaObject): boolean => {
  if (first.oneOf) {
    if (first.oneOf?.length) {
      return true
    }

    throw new Error('Empty oneOf')
  }

  if (second.oneOf) {
    if (second.oneOf?.length) {
      return true
    }

    throw new Error('Empty oneOf')
  }

  return false
}

const mergeSchemasWithOneOfs = (
  first: SchemaObject,
  second: SchemaObject,
  getRef: (ref: ReferenceObject) => SchemaObject
): SchemaObject => {
  const firstOneOf = Array.isArray(first.oneOf) ? first.oneOf : [first]
  const secondOneOf = Array.isArray(second.oneOf) ? second.oneOf : [second]

  const mergedOneOf = crossProduct(firstOneOf, secondOneOf).map(([firstItem, secondItem]) => {
    return mergeSchemasOrRefs(firstItem, secondItem, getRef)
  })

  return {
    oneOf: mergedOneOf
  }
}

const crossProduct = (a: SchemaOrReference[], b: SchemaOrReference[]) => {
  return a.reduce<[SchemaOrReference, SchemaOrReference][]>(
    (acc, x) => [...acc, ...b.map((y): [SchemaOrReference, SchemaOrReference] => [x, y])],
    []
  )
}

const containsRef = (first: SchemaOrReference, second: SchemaOrReference): boolean => {
  return isRef(first) || isRef(second)
}

const mergeSchemas = (
  first: SchemaObject,
  second: SchemaObject,
  getRef: GetRefFn
): SchemaObject => {
  checkTypeConflicts(first, second)
  checkReadOnlyWriteOnlyConflicts(first, second)
  checkFormatConflicts(first, second)
  checkEnumConflicts(first, second)
  checkNumberConstraintsConflicts(first, second)
  checkArrayItemTypeConflicts(first, second)

  if (first.not || second.not) {
    throw new Error('Merging schemas with "not" keyword is not supported')
  }

  return typedMerge(first, second, getRef)
}

const typedMerge = (first: SchemaObject, second: SchemaObject, getRef: GetRefFn): SchemaObject => {
  if (!first.type && !second.type) {
    return genericMerge(first, second, getRef)
  }

  if (first.type && second.type && first.type !== second.type) {
    throw new Error('Cannot merge schemas with different types')
  }

  if (first.type === 'object' || second.type === 'object') {
    return mergeObjectConstraints(first, second, getRef)
  }

  if (first.type === 'array' || second.type === 'array') {
    return mergeArrayConstraints(first, second, getRef)
  }

  if (first.type === 'string' || second.type === 'string') {
    return mergeStringConstraints(first, second, getRef)
  }

  if (first.type === 'number' || second.type === 'number') {
    return mergeNumberConstraints(first, second, getRef)
  }

  if (first.type === 'integer' || second.type === 'integer') {
    return mergeIntegerConstraints(first, second, getRef)
  }

  if (first.type === 'boolean' || second.type === 'boolean') {
    return mergeBooleanConstraints(first, second, getRef)
  }

  throw new Error(`Cannot merge schemas with type "${first.type}" with type "${second.type}"`)
}

const mergeWithRef = (
  first: SchemaOrReference,
  second: SchemaOrReference,
  getRef: (ref: ReferenceObject) => SchemaObject
): SchemaOrReference => {
  if (isRef(first) && isRef(second)) {
    if (first.$ref === second.$ref) {
      return {
        ...first,
        ...second
      }
    } else {
      return mergeSchemas(getRef(first), getRef(second), getRef)
    }
  }

  if (isRef(first) && !isRef(second)) {
    console.log(`MERGE ${JSON.stringify(first.$ref)} with ${JSON.stringify(second)}`)
    const merged = isEmpty(second) ? first : mergeSchemas(getRef(first), second, getRef)
    console.log(`MERGED ${JSON.stringify(merged)}`)
    return merged
  }

  if (!isRef(first) && isRef(second)) {
    console.log(`MERGE ${JSON.stringify(second.$ref)} with ${JSON.stringify(first)}`)
    const merged = isEmpty(first) ? second : mergeSchemas(first, getRef(second), getRef)
    console.log(`MERGED ${JSON.stringify(merged)}`)
    return merged
  }

  throw new Error('Invalid input')
}
