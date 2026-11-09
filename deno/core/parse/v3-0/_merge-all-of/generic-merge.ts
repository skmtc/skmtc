import type { SchemaObject, GenericMergeArgs } from './types.ts'
import { mergeEnumValues } from './merge-enum-values.ts'
import { mergeProperties } from './merge-properties.ts'
import { mergeRequired } from './merge-required.ts'
export const genericMerge = <T>({ first, second, getRef, system, typeCheck }: GenericMergeArgs<T>): SchemaObject => {
  return {
    ...first,
    ...second,
    ...mergeProperties({ first, second, getRef, system }),
    ...mergeRequired(first, second),
    ...mergeEnumValues(first, second, typeCheck)
  }
}
