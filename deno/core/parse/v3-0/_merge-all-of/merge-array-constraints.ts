import { mergeSchemasOrRefs } from './merge.ts'
import type { ArraySchemaObject, SchemaObject, SchemaOrReference, MergeArgs } from './types.ts'
import { genericMerge } from './generic-merge.ts'
import * as v from 'valibot'
import { checkTypeConflicts } from './check-type-conflicts.ts'
export function mergeArrayConstraints({ first, second, getRef, system }: MergeArgs<ArraySchemaObject | SchemaObject>): ArraySchemaObject {
  checkTypeConflicts(first, second)

  if (!('items' in first) && !('items' in second)) {
    throw new Error('Cannot merge array constraints: no items found')
  }

  const result: ArraySchemaObject = {
    ...genericMerge({ first, second, getRef, system, typeCheck: v.array(v.any()) }),
    type: 'array',
    items: mergeItems({ first, second, getRef, system })
  }

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

const mergeItems = ({ first, second, getRef, system }: MergeArgs<ArraySchemaObject | SchemaObject>): SchemaOrReference => {
  if ('items' in first && 'items' in second && first.items && second.items) {
    return mergeSchemasOrRefs({ first: first.items, second: second.items, getRef, system })
  }

  if ('items' in first && first.items) {
    return first.items
  }

  if ('items' in second && second.items) {
    return second.items
  }

  throw new Error('Cannot merge array constraints: no items found')
}
