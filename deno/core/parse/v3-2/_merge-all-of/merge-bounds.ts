import type { SchemaObject } from '@/parse/v3-2/_merge-all-of/types.ts'

export type Bound = {
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

/** The tighter of two lower bounds. */
export const toTighterMinimum = (
  first: Bound | undefined,
  second: Bound | undefined
): Bound | undefined => toTighterBound(first, second, (a, b) => a > b)

/** The tighter of two upper bounds. */
export const toTighterMaximum = (
  first: Bound | undefined,
  second: Bound | undefined
): Bound | undefined => toTighterBound(first, second, (a, b) => a < b)

/** The lower bound of `schema`; exclusive only when `exclusiveMinimum` is `true`. */
export const toMinimum = (schema: SchemaObject): Bound | undefined =>
  schema.minimum === undefined
    ? undefined
    : { value: schema.minimum, exclusive: schema.exclusiveMinimum === true }

/** The upper bound of `schema`; exclusive only when `exclusiveMaximum` is `true`. */
export const toMaximum = (schema: SchemaObject): Bound | undefined =>
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
  writeBounds(
    result,
    toTighterMinimum(toMinimum(first), toMinimum(second)),
    toTighterMaximum(toMaximum(first), toMaximum(second))
  )
}

/**
 * Write `minimum` and `maximum` onto `result` in the normalized form. An
 * undefined bound leaves `result` unchanged.
 */
export const writeBounds = (
  result: SchemaObject,
  minimum: Bound | undefined,
  maximum: Bound | undefined
): void => {
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
