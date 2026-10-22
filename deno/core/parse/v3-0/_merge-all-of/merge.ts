import { isRef } from '@/helpers/refFns.ts'
import type { SchemaOrReference, SchemaObject, GetRefFn } from './types.ts'
import { closesCycle, enteringRef } from './ref-cycle.ts'
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

const mergeWithRef = (
  first: SchemaOrReference,
  second: SchemaOrReference,
  getRef: GetRefFn
): SchemaOrReference => {
  // A side already being expanded above us closes a cycle, so it cannot be
  // resolved again — there is no finite inlining.
  //
  // What happens next depends on the other side. If the other side is empty the
  // reference SURVIVES, and `toSchemaV3` turns it into an `OasRef` that resolves
  // lazily at use time. If the other side carries content we keep that content
  // and DROP the reference — so any constraint the referent imposes is lost from
  // this position. That is not obviously right: the alternative is to keep both
  // (`{allOf: [first, second]}`), which preserves the constraint but re-enters
  // this branch on the way back up and needs a termination argument of its own.
  //
  // Known limitation, tracked with the guard's scoping redesign (see the
  // `expanding` set on `GetRefFn`): the path is a property of ONE position, but
  // the resolver carrying it governs a two-sided merge, so a reference on the
  // opposite side that happens to name the same schema is also treated as
  // closing a cycle. Measured at 4 sites in 2 of 66 sampled specs.
  if (closesCycle(getRef, first)) {
    return isEmpty(second) ? first : second
  }

  if (closesCycle(getRef, second)) {
    return isEmpty(first) ? second : first
  }

  // A resolved referent's `allOf` is consumed HERE, while this expansion's
  // path is still on the resolver.
  //
  // That `allOf` was the second half of the runaway. `mergeSchemas` has no
  // `allOf` dispatch, so `typedMerge` copied the key into its output, where it
  // escaped UPWARD in the data and was re-expanded at a frame whose resolver
  // carried none of the path. The cycle marker is scoped to the descent; the
  // unconsumed `allOf` outlived it.
  //
  // Only `allOf`. Handing the referent to `mergeSchemasOrRefs` instead would
  // also dispatch its `oneOf`/`anyOf` to `mergeCrossProduct`, whose `toGroup`
  // keeps the member list and discards every sibling keyword on that node — a
  // referent's `discriminator`, `description`, `properties` and `required` all
  // vanish, on acyclic documents. A union needs no consuming here: it survives
  // as data and `toSchemaV3` parses it later, which is what `main` does.
  // (`toGroup` dropping those siblings is a real defect, tracked on skmtc#117
  // as its own line item; it is not this PR's to change.)
  if (isRef(first) && isRef(second)) {
    if (first.$ref === second.$ref) {
      return {
        ...first,
        ...second
      }
    } else {
      const scoped = enteringRef(enteringRef(getRef, first), second)

      return mergeResolved(
        consumeAllOf(getRef(first), scoped),
        consumeAllOf(getRef(second), scoped),
        scoped
      )
    }
  }

  if (isRef(first) && !isRef(second)) {
    if (isEmpty(second)) {
      return first
    }

    const scoped = enteringRef(getRef, first)

    return mergeResolved(consumeAllOf(getRef(first), scoped), second, scoped)
  }

  if (!isRef(first) && isRef(second)) {
    if (isEmpty(first)) {
      return second
    }

    const scoped = enteringRef(getRef, second)

    return mergeResolved(first, consumeAllOf(getRef(second), scoped), scoped)
  }

  throw new Error('Invalid input')
}

/** A referent's `allOf`, squashed. Anything else is returned untouched. */
const consumeAllOf = (schema: SchemaOrReference, getRef: GetRefFn): SchemaOrReference => {
  if (isRef(schema) || !schema.allOf?.length) {
    return schema
  }

  return mergeIntersection({ schema, getRef })
}

/**
 * Merge two schemas that have already been resolved. `consumeAllOf` can still
 * hand back a reference — a single-member `allOf`, or one the cycle guard
 * refused to expand — so that case goes back through the ref path, where the
 * resolver already carries the expansion path that terminates it.
 */
const mergeResolved = (
  first: SchemaOrReference,
  second: SchemaOrReference,
  getRef: GetRefFn
): SchemaOrReference => {
  if (isRef(first) || isRef(second)) {
    return mergeWithRef(first, second, getRef)
  }

  return mergeSchemas(first, second, getRef)
}
