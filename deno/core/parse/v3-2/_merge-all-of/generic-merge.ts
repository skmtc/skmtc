import type { SchemaObject, GetRefFn } from './types.ts'
import { mergeEnumValues } from './merge-enum-values.ts'
import { mergeProperties } from './merge-properties.ts'
import { mergeRequired } from './merge-required.ts'
import type * as v from 'valibot'
export const genericMerge = <T>(
  first: SchemaObject,
  second: SchemaObject,
  getRef: GetRefFn,
  typeCheck?: v.GenericSchema<T>
): SchemaObject => {
  return {
    ...first,
    ...second,
    ...mergeProperties(first, second, getRef),
    ...mergeRequired(first, second),
    ...mergeEnumValues(first, second, typeCheck)
  }
}
