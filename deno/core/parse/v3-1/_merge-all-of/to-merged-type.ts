import type { SchemaObject } from './types.ts'

/**
 * The `type` a scalar merger should write.
 *
 * 3.1 lets `type` be a list — `['string', 'null']` is a nullable string — and
 * `checkAtLeastOneTypeMatch` routes such a schema to the scalar merger because
 * the scalar is a member of the list. The merger must not then flatten it: the
 * `null` would be dropped, and `normalizeTypeArray` (which turns the list into
 * `type` + `nullable`) runs on the MERGED result, so by the time it looks the
 * nullability is already gone and the field emits as non-nullable.
 *
 * The object/array paths never had this problem — they merge through
 * `genericMerge`, which spreads `type` through untouched.
 *
 * `checkTypeConflicts` has already established the two sides agree, so either
 * list is as good as the other; the first one present wins, and a plain scalar
 * on both sides keeps the scalar.
 */
export const toMergedType = (
  first: SchemaObject['type'],
  second: SchemaObject['type'],
  scalar: 'string' | 'number' | 'integer'
): SchemaObject['type'] => {
  if (Array.isArray(first)) {
    return first
  }

  if (Array.isArray(second)) {
    return second
  }

  return scalar
}
