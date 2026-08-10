import type { SchemaObject } from './types.ts'

type SchemaType = 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array'

/**
 * 3.1's `type` may be a list, so `first.type === type` misses the nullable
 * spellings this dialect uses everywhere — `['string', 'null']` is a nullable
 * string. `checkTypeConflicts` has already established the two sides agree; this
 * only picks which per-type merger runs, so the question is whether `type`
 * appears at all.
 *
 * `'null'` is skipped when narrowing: `['string','null']` is merged as a string.
 * Nullability rides on the type list and is preserved by the mergers copying
 * `type` through — it is not a type to dispatch on, and there is no
 * `mergeNullConstraints`.
 *
 * The v3-0 counterpart compares strings and is right to: 3.0 spells nullability
 * as a separate `nullable: true` and its `type` is always a single value.
 */
const hasType = (schemaType: SchemaObject['type'], type: SchemaType): boolean =>
  Array.isArray(schemaType) ? schemaType.includes(type) : schemaType === type

export const checkAtLeastOneTypeMatch = (
  first: SchemaObject,
  second: SchemaObject,
  type: SchemaType
): boolean => {
  return (
    (hasType(first.type, type) && hasType(second.type, type)) ||
    (hasType(first.type, type) && !second.type) ||
    (!first.type && hasType(second.type, type))
  )
}
