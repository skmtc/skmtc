import { isRef } from '@/helpers/refFns.ts'
import type {
  SchemaOrReference,
  ReferenceObject,
  SchemaObject,
  GetRefFn,
  NormalizeFn
} from './types.ts'
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
import { checkAtLeastOneTypeMatch } from './check-at-least-one-type-match.ts'
import { mergeIntersection } from './merge-intersection.ts'
import { mergeCrossProduct } from './merge-union.ts'
import { isEmpty } from '@/helpers/isEmpty.ts'
import { isNullOnly, mergeNullOnly } from './nullable-merge.ts'

export const mergeSchemasOrRefs = (
  inputFirst: SchemaOrReference,
  inputSecond: SchemaOrReference,
  getRef: GetRefFn,
  normalize: NormalizeFn
): SchemaOrReference => {
  const first = isRef(inputFirst) ? inputFirst : normalize(inputFirst)
  const second = isRef(inputSecond) ? inputSecond : normalize(inputSecond)

  if (containsRef(first, second)) {
    return mergeWithRef(first, second, getRef, normalize)
  }

  if (isRef(first)) {
    throw new Error('Ref in first')
  }

  if (isRef(second)) {
    throw new Error('Ref in second')
  }

  if (containsAllOf(first) || containsAllOf(second)) {
    const mergedFirst = containsAllOf(first)
      ? mergeIntersection({ schema: first, getRef, normalize })
      : first

    const mergedSecond = containsAllOf(second)
      ? mergeIntersection({ schema: second, getRef, normalize })
      : second

    return mergeSchemasOrRefs(mergedFirst, mergedSecond, getRef, normalize)
  }

  if (containsOneOf(first, second)) {
    return mergeCrossProduct({ first, second, getRef, normalize, groupType: 'oneOf' })
  }

  if (containsAnyOf(first, second)) {
    return mergeCrossProduct({ first, second, getRef, normalize, groupType: 'anyOf' })
  }

  if (isNullOnly(first)) {
    return mergeNullOnly(second)
  }

  if (isNullOnly(second)) {
    return mergeNullOnly(first)
  }

  return mergeSchemas(first, second, getRef, normalize)
}

const containsAllOf = (schema: SchemaObject): boolean => {
  if (schema.allOf) {
    if (schema.allOf?.length) {
      return true
    }

    throw new Error('Empty allOf')
  }

  return false
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

const containsRef = (first: SchemaOrReference, second: SchemaOrReference): boolean => {
  return isRef(first) || isRef(second)
}

const mergeSchemas = (
  first: SchemaObject,
  second: SchemaObject,
  getRef: GetRefFn,
  normalize: NormalizeFn
): SchemaObject => {
  try {
    checkTypeConflicts(first, second)
  } catch (e) {
    throw e
  }

  checkReadOnlyWriteOnlyConflicts(first, second)
  checkFormatConflicts(first, second)
  checkEnumConflicts(first, second)
  checkNumberConstraintsConflicts(first, second)
  checkArrayItemTypeConflicts(first, second, normalize)

  if (first.not || second.not) {
    throw new Error('Merging schemas with "not" keyword is not supported')
  }

  return typedMerge(first, second, getRef, normalize)
}

const typedMerge = (
  first: SchemaObject,
  second: SchemaObject,
  getRef: GetRefFn,
  normalize: NormalizeFn
): SchemaObject => {
  if (!first.type && !second.type) {
    return genericMerge(first, second, getRef, normalize)
  }

  if (checkAtLeastOneTypeMatch(first, second, 'object')) {
    return mergeObjectConstraints(first, second, getRef, normalize)
  }

  if (checkAtLeastOneTypeMatch(first, second, 'array')) {
    return mergeArrayConstraints(first, second, getRef, normalize)
  }

  if (checkAtLeastOneTypeMatch(first, second, 'string')) {
    return mergeStringConstraints(first, second, getRef, normalize)
  }

  if (checkAtLeastOneTypeMatch(first, second, 'number')) {
    return mergeNumberConstraints(first, second, getRef, normalize)
  }

  if (checkAtLeastOneTypeMatch(first, second, 'integer')) {
    return mergeIntegerConstraints(first, second, getRef, normalize)
  }

  if (checkAtLeastOneTypeMatch(first, second, 'boolean')) {
    return mergeBooleanConstraints(first, second, getRef, normalize)
  }

  throw new Error(`Cannot merge schemas with type "${first.type}" with type "${second.type}"`)
}

const mergeWithRef = (
  first: SchemaOrReference,
  second: SchemaOrReference,
  getRef: GetRefFn,
  normalize: NormalizeFn
): SchemaOrReference => {
  const readRef = (ref: ReferenceObject): SchemaObject => normalize(getRef(ref))

  if (isRef(first) && isRef(second)) {
    if (first.$ref === second.$ref) {
      return {
        ...first,
        ...second
      }
    } else {
      return mergeSchemas(readRef(first), readRef(second), getRef, normalize)
    }
  }

  if (isRef(first) && !isRef(second)) {
    const merged = isEmpty(second) ? first : mergeSchemas(readRef(first), second, getRef, normalize)

    return merged
  }

  if (!isRef(first) && isRef(second)) {
    const merged = isEmpty(first) ? second : mergeSchemas(first, readRef(second), getRef, normalize)

    return merged
  }

  throw new Error('Invalid input')
}
