import { isRef } from '@/helpers/refFns.ts'
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
import { checkAtLeastOneTypeMatch } from './check-at-least-one-type-match.ts'
import { mergeIntersection } from './merge-intersection.ts'
import { mergeCrossProduct } from './merge-union.ts'
import { isEmpty } from '@/helpers/isEmpty.ts'
import { isNullOnly, mergeNullOnly } from './nullable-merge.ts'
import { isExpanding, whileExpanding } from './ref-expansion.ts'

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

  if (containsAllOf(first) || containsAllOf(second)) {
    const mergedFirst = containsAllOf(first) ? mergeIntersection({ schema: first, getRef }) : first

    const mergedSecond = containsAllOf(second)
      ? mergeIntersection({ schema: second, getRef })
      : second

    return mergeSchemasOrRefs(mergedFirst, mergedSecond, getRef)
  }

  if (containsOneOf(first, second)) {
    return mergeCrossProduct({ first, second, getRef, groupType: 'oneOf' })
  }

  if (containsAnyOf(first, second)) {
    return mergeCrossProduct({ first, second, getRef, groupType: 'anyOf' })
  }

  if (isNullOnly(first)) {
    return mergeNullOnly(second)
  }

  if (isNullOnly(second)) {
    return mergeNullOnly(first)
  }

  return mergeSchemas(first, second, getRef)
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
  getRef: GetRefFn
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

  if (checkAtLeastOneTypeMatch(first, second, 'object')) {
    return mergeObjectConstraints(first, second, getRef)
  }

  if (checkAtLeastOneTypeMatch(first, second, 'array')) {
    return mergeArrayConstraints(first, second, getRef)
  }

  if (checkAtLeastOneTypeMatch(first, second, 'string')) {
    return mergeStringConstraints(first, second, getRef)
  }

  if (checkAtLeastOneTypeMatch(first, second, 'number')) {
    return mergeNumberConstraints(first, second, getRef)
  }

  if (checkAtLeastOneTypeMatch(first, second, 'integer')) {
    return mergeIntegerConstraints(first, second, getRef)
  }

  if (checkAtLeastOneTypeMatch(first, second, 'boolean')) {
    return mergeBooleanConstraints(first, second, getRef)
  }

  throw new Error(`Cannot merge schemas with type "${first.type}" with type "${second.type}"`)
}

/**
 * Dereference `ref` AND flatten any `allOf` in its body, both inside the
 * caller's expansion window.
 *
 * `genericMerge` spreads its inputs, so an `allOf` left on a dereferenced body
 * is copied into the merge result and escapes to be expanded later — by which
 * time the ref is no longer marked open and the cycle guard cannot see it.
 * Flattening here keeps every expansion inside the window that guards it.
 */
const expandRef = (ref: ReferenceObject, getRef: GetRefFn): SchemaOrReference => {
  const body = getRef(ref)

  return containsAllOf(body) ? mergeIntersection({ schema: body, getRef }) : body
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
    }

    // A ref already open on this path contributes nothing further, so the merge
    // degenerates to whichever side can still be expanded.
    if (isExpanding(first)) {
      return isExpanding(second) ? first : second
    }

    if (isExpanding(second)) {
      return first
    }

    return whileExpanding(first, () =>
      whileExpanding(second, () =>
        mergeSchemasOrRefs(expandRef(first, getRef), expandRef(second, getRef), getRef)
      )
    )
  }

  if (isRef(first) && !isRef(second)) {
    if (isEmpty(second)) {
      return first
    }

    if (isExpanding(first)) {
      return second
    }

    return whileExpanding(first, () => mergeSchemasOrRefs(expandRef(first, getRef), second, getRef))
  }

  if (!isRef(first) && isRef(second)) {
    if (isEmpty(first)) {
      return second
    }

    if (isExpanding(second)) {
      return first
    }

    return whileExpanding(second, () => mergeSchemasOrRefs(first, expandRef(second, getRef), getRef))
  }

  throw new Error('Invalid input')
}
