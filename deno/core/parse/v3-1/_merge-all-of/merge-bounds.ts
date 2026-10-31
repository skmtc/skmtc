import type { SchemaObject } from '@/parse/v3-1/_merge-all-of/types.ts'

type Bound = {
  value: number
  exclusive: boolean
}

/**
 * Pick the tighter of two bounds. The tighter bound keeps its own
 * exclusivity; when both bounds are equal, exclusive wins.
 */
const toTighterBound = (
  first: Bound | undefined,
  second: Bound | undefined,
  isTighter: (a: number, b: number) => boolean
): Bound | undefined => {
  if (first === undefined || second === undefined) {
    return first ?? second
  }

  if (first.value === second.value) {
    return { value: first.value, exclusive: first.exclusive || second.exclusive }
  }

  return isTighter(first.value, second.value) ? first : second
}

const toMinimum = (schema: SchemaObject): Bound | undefined =>
  schema.minimum === undefined
    ? undefined
    : { value: schema.minimum, exclusive: schema.exclusiveMinimum === true }

const toMaximum = (schema: SchemaObject): Bound | undefined =>
  schema.maximum === undefined
    ? undefined
    : { value: schema.maximum, exclusive: schema.exclusiveMaximum === true }

/**
 * Write the merged `minimum`/`exclusiveMinimum` and `maximum`/`exclusiveMaximum`
 * of `first` and `second` onto `result`. Members are in the normalized form,
 * where an exclusive bound is `minimum` plus `exclusiveMinimum: true`.
 */
export const mergeBounds = (
  result: SchemaObject,
  first: SchemaObject,
  second: SchemaObject
): void => {
  const minimum = toTighterBound(toMinimum(first), toMinimum(second), (a, b) => a > b)
  const maximum = toTighterBound(toMaximum(first), toMaximum(second), (a, b) => a < b)

  if (minimum !== undefined) {
    result.minimum = minimum.value

    if (minimum.exclusive) {
      result.exclusiveMinimum = true
    } else {
      delete result.exclusiveMinimum
    }
  }

  if (maximum !== undefined) {
    result.maximum = maximum.value

    if (maximum.exclusive) {
      result.exclusiveMaximum = true
    } else {
      delete result.exclusiveMaximum
    }
  }
}
