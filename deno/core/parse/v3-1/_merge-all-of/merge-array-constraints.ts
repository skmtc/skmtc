import { mergeSchemasOrRefs } from './merge.ts'
import type {
  ArraySchemaObject,
  GetRefFn,
  NormalizeFn,
  SchemaObject,
  SchemaOrReference
} from './types.ts'
import { genericMerge } from './generic-merge.ts'
import * as v from 'valibot'
import { checkTypeConflicts } from './check-type-conflicts.ts'
export function mergeArrayConstraints(
  first: ArraySchemaObject | SchemaObject,
  second: ArraySchemaObject | SchemaObject,
  getRef: GetRefFn,
  normalize: NormalizeFn
): SchemaObject {
  checkTypeConflicts(first, second)

  const merged = genericMerge(first, second, getRef, normalize, v.array(v.any()))
  const items = mergeItems(first, second, getRef, normalize)

  // With no `items` on either side, `items` stays absent (unknown items).
  const result: SchemaObject = items === undefined ? merged : { ...merged, type: 'array', items }

  // Merge minItems
  if (first.minItems !== undefined || second.minItems !== undefined) {
    const minA = first.minItems ?? 0
    const minB = second.minItems ?? 0
    result.minItems = Math.max(minA, minB)
  }

  // Merge maxItems
  if (first.maxItems !== undefined || second.maxItems !== undefined) {
    const maxA = first.maxItems ?? Infinity
    const maxB = second.maxItems ?? Infinity
    result.maxItems = Math.min(maxA, maxB)
  }

  // Merge uniqueItems
  if (first.uniqueItems || second.uniqueItems) {
    result.uniqueItems = true
  }

  return result
}

const mergeItems = (
  first: ArraySchemaObject | SchemaObject,
  second: ArraySchemaObject | SchemaObject,
  getRef: GetRefFn,
  normalize: NormalizeFn
): SchemaOrReference | undefined => {
  if ('items' in first && 'items' in second && first.items && second.items) {
    return mergeSchemasOrRefs(first.items, second.items, getRef, normalize)
  }

  if ('items' in first && first.items) {
    return first.items
  }

  if ('items' in second && second.items) {
    return second.items
  }

  return undefined
}
