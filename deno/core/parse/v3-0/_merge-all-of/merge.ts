import { isRef } from '@/helpers/refFns.ts'
import type { SchemaOrReference, SchemaObject, MergeArgs } from './types.ts'
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
import { mergeCrossProduct, toOwnSystem } from './merge-union.ts'
import { isEmpty } from '@/helpers/isEmpty.ts'
import { isNullOnly, mergeNullOnly } from './nullable-merge.ts'
import { withoutUnknownAnyOf } from '@/parse/anyOfSystem.ts'

export const mergeSchemasOrRefs = ({ first, second, getRef, system }: MergeArgs<SchemaOrReference>): SchemaOrReference => {
  if (containsRef(first, second)) {
    return mergeWithRef({ first, second, getRef, system })
  }

  if (isRef(first)) {
    throw new Error('Ref in first')
  }

  if (isRef(second)) {
    throw new Error('Ref in second')
  }

  // Under `system.anyOf: unknown` an `anyOf` of two or more members is any
  // value, so it adds nothing to the merge: its members are left out, and the
  // keywords next to it merge as usual.
  const firstKeywords = withoutUnknownAnyOf({ schema: first, setting: system.anyOf })
  const secondKeywords = withoutUnknownAnyOf({ schema: second, setting: system.anyOf })

  if (firstKeywords !== first || secondKeywords !== second) {
    system.unknown?.add('anyOf')

    return mergeSchemasOrRefs({ first: firstKeywords, second: secondKeywords, getRef, system })
  }

  if (containsAllOf(first) || containsAllOf(second)) {
    // Each member's own `allOf` merges under the `client.json` setting, also in
    // the strict first pass over a cross product's pairs.
    const ownSystem = toOwnSystem(system)
    const mergedFirst = containsAllOf(first) ? mergeIntersection({ schema: first, getRef, system: ownSystem }) : first

    const mergedSecond = containsAllOf(second)
      ? mergeIntersection({ schema: second, getRef, system: ownSystem })
      : second

    return mergeSchemasOrRefs({ first: mergedFirst, second: mergedSecond, getRef, system })
  }

  if (containsOneOf(first, second)) {
    return mergeCrossProduct({ first, second, getRef, system, groupType: 'oneOf' })
  }

  if (containsAnyOf(first, second)) {
    return mergeCrossProduct({ first, second, getRef, system, groupType: 'anyOf' })
  }

  if (isNullOnly(first)) {
    return mergeNullOnly(second)
  }

  if (isNullOnly(second)) {
    return mergeNullOnly(first)
  }

  return mergeSchemas({ first, second, getRef, system })
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

const mergeSchemas = ({ first, second, getRef, system }: MergeArgs<SchemaObject>): SchemaObject => {
  // Every integer is a number, so a `number` merged with an `integer` is an
  // `integer` with the constraints of both. Nothing contradicts.
  if (isNumberAndInteger(first, second)) {
    return mergeSchemas({ first: { ...first, type: 'integer' }, second: { ...second, type: 'integer' }, getRef, system })
  }

  if (system.allOf === 'latestWins') {
    // The later member wins a contradiction: a type it disagrees with makes
    // it the whole schema, and any other keyword it disagrees with is left
    // out of the earlier member before they merge.
    if (first.type && second.type && first.type !== second.type) {
      system.replaced.add('type')

      return second
    }

    const earlier = withoutContradictions({ first, second, replaced: system.replaced })

    return mergeChecked({ first: earlier, second, getRef, system })
  }

  return mergeChecked({ first, second, getRef, system })
}

/** A check two members must pass, and the keywords of the earlier member that `latestWins` leaves out when it fails. */
type Contradiction = {
  check: (first: SchemaObject, second: SchemaObject) => void
  keywords: string[]
}

const CONTRADICTIONS: Contradiction[] = [
  { check: checkReadOnlyWriteOnlyConflicts, keywords: ['readOnly', 'writeOnly'] },
  { check: checkFormatConflicts, keywords: ['format'] },
  { check: checkEnumConflicts, keywords: ['enum'] },
  { check: checkNumberConstraintsConflicts, keywords: ['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum'] },
  { check: checkArrayItemTypeConflicts, keywords: ['items'] }
]

type WithoutContradictionsArgs = {
  first: SchemaObject
  second: SchemaObject
  /** Where each keyword left out is named, for the warning. */
  replaced: Set<string>
}

/** `first` without the keywords that contradict `second`, each named in `replaced`. */
const withoutContradictions = ({ first, second, replaced }: WithoutContradictionsArgs): SchemaObject =>
  CONTRADICTIONS.reduce((earlier, { check, keywords }) => {
    try {
      check(earlier, second)

      return earlier
    } catch {
      const entries = Object.entries(earlier)

      entries.filter(([key, value]) => keywords.includes(key) && value !== undefined).forEach(([key]) => replaced.add(key))

      return Object.fromEntries(entries.filter(([key]) => !keywords.includes(key)))
    }
  }, first)

const mergeChecked = ({ first, second, getRef, system }: MergeArgs<SchemaObject>): SchemaObject => {
  checkTypeConflicts(first, second)
  checkReadOnlyWriteOnlyConflicts(first, second)
  checkFormatConflicts(first, second)
  checkEnumConflicts(first, second)
  checkNumberConstraintsConflicts(first, second)
  checkArrayItemTypeConflicts(first, second)

  if ((first.not || second.not) && system.not !== 'unknown') {
    throw new Error('Merging schemas with "not" keyword is not supported')
  }

  return typedMerge({ first, second, getRef, system })
}

const typedMerge = ({ first, second, getRef, system }: MergeArgs<SchemaObject>): SchemaObject => {
  if (!first.type && !second.type) {
    return genericMerge({ first, second, getRef, system })
  }

  if (checkAtLeastOneTypeMatch(first, second, 'object')) {
    return mergeObjectConstraints({ first, second, getRef, system })
  }

  if (checkAtLeastOneTypeMatch(first, second, 'array')) {
    return mergeArrayConstraints({ first, second, getRef, system })
  }

  if (checkAtLeastOneTypeMatch(first, second, 'string')) {
    return mergeStringConstraints({ first, second, getRef, system })
  }

  if (checkAtLeastOneTypeMatch(first, second, 'number')) {
    return mergeNumberConstraints({ first, second, getRef, system })
  }

  if (checkAtLeastOneTypeMatch(first, second, 'integer')) {
    return mergeIntegerConstraints({ first, second, getRef, system })
  }

  if (checkAtLeastOneTypeMatch(first, second, 'boolean')) {
    return mergeBooleanConstraints({ first, second, getRef, system })
  }

  throw new Error(`Cannot merge schemas with type "${first.type}" with type "${second.type}"`)
}

const mergeWithRef = ({ first, second, getRef, system }: MergeArgs<SchemaOrReference>): SchemaOrReference => {
  if (isRef(first) && isRef(second)) {
    if (first.$ref === second.$ref) {
      return {
        ...first,
        ...second
      }
    } else {
      return mergeSchemasOrRefs({ first: getRef(first), second: getRef(second), getRef, system })
    }
  }

  // A target followed through its reference merges as any schema does: a
  // `oneOf` or `anyOf` in either one is crossed with the other, not kept
  // beside the merged properties.
  if (isRef(first) && !isRef(second)) {
    const merged = isEmpty(second) ? first : mergeSchemasOrRefs({ first: getRef(first), second, getRef, system })

    return merged
  }

  if (!isRef(first) && isRef(second)) {
    const merged = isEmpty(first) ? second : mergeSchemasOrRefs({ first, second: getRef(second), getRef, system })

    return merged
  }

  throw new Error('Invalid input')
}
