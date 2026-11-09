import type { MergeArgs } from './types.ts'
import { isRef } from '@/helpers/refFns.ts'
import type {
  SchemaOrReference,
  ReferenceObject,
  SchemaObject,
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
import { collapseNullOnlyUnion, mergeCrossProduct } from './merge-union.ts'
import { isEmpty } from '@/helpers/isEmpty.ts'
import { isNullOnly, mergeNullOnly } from './nullable-merge.ts'

export const mergeSchemasOrRefs = ({
  first: inputFirst,
  second: inputSecond,
  getRef,
  normalize,
  system
}: MergeArgs<SchemaOrReference>): SchemaOrReference => {
  const first = isRef(inputFirst)
    ? inputFirst
    : collapseNullOnlyUnion(normalize(inputFirst), normalize)
  const second = isRef(inputSecond)
    ? inputSecond
    : collapseNullOnlyUnion(normalize(inputSecond), normalize)

  if (containsRef(first, second)) {
    return mergeWithRef({ first, second, getRef, normalize, system })
  }

  if (isRef(first)) {
    throw new Error('Ref in first')
  }

  if (isRef(second)) {
    throw new Error('Ref in second')
  }

  if (containsAllOf(first) || containsAllOf(second)) {
    const mergedFirst = containsAllOf(first)
      ? mergeIntersection({ schema: first, getRef, normalize, system })
      : first

    const mergedSecond = containsAllOf(second)
      ? mergeIntersection({ schema: second, getRef, normalize, system })
      : second

    return mergeSchemasOrRefs({ first: mergedFirst, second: mergedSecond, getRef, normalize, system })
  }

  if (containsOneOf(first, second)) {
    return mergeCrossProduct({ first, second, getRef, normalize, system, groupType: 'oneOf' })
  }

  if (containsAnyOf(first, second)) {
    return mergeCrossProduct({ first, second, getRef, normalize, system, groupType: 'anyOf' })
  }

  if (isNullOnly(first)) {
    return mergeNullOnly(second)
  }

  if (isNullOnly(second)) {
    return mergeNullOnly(first)
  }

  return mergeSchemas({ first, second, getRef, normalize, system })
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

/** Whether one member says `number` and the other `integer`. */
const isNumberAndInteger = (first: SchemaObject, second: SchemaObject): boolean =>
  (first.type === 'number' && second.type === 'integer') || (first.type === 'integer' && second.type === 'number')

const mergeSchemas = ({ first, second, getRef, normalize, system }: MergeArgs<SchemaObject>): SchemaObject => {
  // Every integer is a number, so a `number` merged with an `integer` is an
  // `integer` with the constraints of both. Nothing contradicts.
  if (isNumberAndInteger(first, second)) {
    return mergeSchemas({
      first: { ...first, type: 'integer' },
      second: { ...second, type: 'integer' },
      getRef,
      normalize,
      system
    })
  }

  if (system.allOf === 'latestWins') {
    // The later member wins a contradiction: a type it disagrees with makes
    // it the whole schema, and any other keyword it disagrees with is left
    // out of the earlier member before they merge.
    if (first.type && second.type && first.type !== second.type) {
      system.replaced.add('type')

      return second
    }

    const earlier = withoutContradictions({ first, second, normalize, replaced: system.replaced })

    return mergeChecked({ first: earlier, second, getRef, normalize, system })
  }

  return mergeChecked({ first, second, getRef, normalize, system })
}

/** A check two members must pass, and the keywords of the earlier member that `latestWins` leaves out when it fails. */
type Contradiction = {
  check: (first: SchemaObject, second: SchemaObject) => void
  keywords: string[]
}

type WithoutContradictionsArgs = {
  first: SchemaObject
  second: SchemaObject
  normalize: NormalizeFn
  /** Where each keyword left out is named, for the warning. */
  replaced: Set<string>
}

/** `first` without the keywords that contradict `second`, each named in `replaced`. */
const withoutContradictions = ({ first, second, normalize, replaced }: WithoutContradictionsArgs): SchemaObject => {
  const contradictions: Contradiction[] = [
    { check: checkReadOnlyWriteOnlyConflicts, keywords: ['readOnly', 'writeOnly'] },
    { check: checkFormatConflicts, keywords: ['format'] },
    { check: checkEnumConflicts, keywords: ['enum'] },
    { check: checkNumberConstraintsConflicts, keywords: ['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum'] },
    { check: (a, b) => checkArrayItemTypeConflicts(a, b, normalize), keywords: ['items'] }
  ]

  return contradictions.reduce((earlier, { check, keywords }) => {
    try {
      check(earlier, second)

      return earlier
    } catch {
      const entries = Object.entries(earlier)

      entries.filter(([key, value]) => keywords.includes(key) && value !== undefined).forEach(([key]) => replaced.add(key))

      return Object.fromEntries(entries.filter(([key]) => !keywords.includes(key)))
    }
  }, first)
}

const mergeChecked = ({ first, second, getRef, normalize, system }: MergeArgs<SchemaObject>): SchemaObject => {
  checkTypeConflicts(first, second)
  checkReadOnlyWriteOnlyConflicts(first, second)
  checkFormatConflicts(first, second)
  checkEnumConflicts(first, second)
  checkNumberConstraintsConflicts(first, second)
  checkArrayItemTypeConflicts(first, second, normalize)

  if ((first.not || second.not) && system.not !== 'unknown') {
    throw new Error('Merging schemas with "not" keyword is not supported')
  }

  return typedMerge({ first, second, getRef, normalize, system })
}

const typedMerge = ({ first, second, getRef, normalize, system }: MergeArgs<SchemaObject>): SchemaObject => {
  if (!first.type && !second.type) {
    return genericMerge({ first, second, getRef, normalize, system })
  }

  if (checkAtLeastOneTypeMatch(first, second, 'object')) {
    return mergeObjectConstraints({ first, second, getRef, normalize, system })
  }

  if (checkAtLeastOneTypeMatch(first, second, 'array')) {
    return mergeArrayConstraints({ first, second, getRef, normalize, system })
  }

  if (checkAtLeastOneTypeMatch(first, second, 'string')) {
    return mergeStringConstraints({ first, second, getRef, normalize, system })
  }

  if (checkAtLeastOneTypeMatch(first, second, 'number')) {
    return mergeNumberConstraints({ first, second, getRef, normalize, system })
  }

  if (checkAtLeastOneTypeMatch(first, second, 'integer')) {
    return mergeIntegerConstraints({ first, second, getRef, normalize, system })
  }

  if (checkAtLeastOneTypeMatch(first, second, 'boolean')) {
    return mergeBooleanConstraints({ first, second, getRef, normalize, system })
  }

  throw new Error(`Cannot merge schemas with type "${first.type}" with type "${second.type}"`)
}

const mergeWithRef = ({ first, second, getRef, normalize, system }: MergeArgs<SchemaOrReference>): SchemaOrReference => {
  const readRef = (ref: ReferenceObject): SchemaObject => normalize(getRef(ref))

  if (isRef(first) && isRef(second)) {
    if (first.$ref === second.$ref) {
      return {
        ...first,
        ...second
      }
    } else {
      return mergeSchemasOrRefs({ first: readRef(first), second: readRef(second), getRef, normalize, system })
    }
  }

  // A target followed through its reference merges as any schema does: a
  // `oneOf` or `anyOf` in either one is crossed with the other, not kept
  // beside the merged properties.
  if (isRef(first) && !isRef(second)) {
    const merged = isEmpty(second) ? first : mergeSchemasOrRefs({ first: readRef(first), second, getRef, normalize, system })

    return merged
  }

  if (!isRef(first) && isRef(second)) {
    const merged = isEmpty(first) ? second : mergeSchemasOrRefs({ first, second: readRef(second), getRef, normalize, system })

    return merged
  }

  throw new Error('Invalid input')
}
