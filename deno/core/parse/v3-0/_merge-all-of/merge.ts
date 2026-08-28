import { isRef } from '@/helpers/refFns.ts'
import type { GetRefFn, ReferenceObject, SchemaObject, SchemaOrReference } from './types.ts'
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
  firstInput: SchemaOrReference,
  secondInput: SchemaOrReference,
  getRef: GetRefFn
): SchemaOrReference => {
  // An inline `allOf` that is being eliminated right now (reached again
  // through a union member of its own base) is the schema under
  // construction: refer to it by name rather than merge it a second time.
  const first = toChainRef(firstInput, getRef)
  const second = toChainRef(secondInput, getRef)

  if (containsRef(first, second)) {
    return mergeWithRef(first, second, getRef)
  }

  if (isRef(first)) {
    throw new Error('Ref in first')
  }

  if (isRef(second)) {
    throw new Error('Ref in second')
  }

  // Merging with the empty schema is the identity. The other operand comes
  // back UNCHANGED — the same object, not a copy — so an inline `allOf`
  // reaching here as a union member (the accumulator starts empty) arrives
  // at `toSchemaV3` as the author's own node, where a recursive one is
  // recognised by identity (see `SchemaExpansion`).
  // `not` is refused whichever side it is on, BEFORE the identity shortcut:
  // a union member of `{ not: {} }` ("matches nothing", seen in the wild as
  // a placeholder) has always been dropped from the cross product by the
  // throw below, leaving the other members. Returning it unchanged would
  // instead refuse the whole union one level up.
  if (first.not || second.not) {
    throw new Error('Merging schemas with "not" keyword is not supported')
  }

  if (isEmpty(first)) {
    return second
  }

  if (isEmpty(second)) {
    return first
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

const toChainRef = (schema: SchemaOrReference, getRef: GetRefFn): SchemaOrReference => {
  if (isRef(schema)) {
    return schema
  }

  const name = getRef.chainNameOf?.(schema)

  return name === undefined ? schema : { $ref: `#/components/schemas/${name}` }
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
    const merged = isEmpty(second) ? first : mergeSchemas(getRef(first), second, getRef)

    return merged
  }

  if (!isRef(first) && isRef(second)) {
    const merged = isEmpty(first) ? second : mergeSchemas(first, getRef(second), getRef)

    return merged
  }

  throw new Error('Invalid input')
}
