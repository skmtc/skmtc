import type { OpenAPIV3 } from 'openapi-types'
import { isRef } from '@/helpers/refFns.ts'
import type { NormalizeFn } from '@/parse/v3-1/_merge-all-of/types.ts'

export const checkArrayItemTypeConflicts = (
  a: OpenAPIV3.SchemaObject,
  b: OpenAPIV3.SchemaObject,
  normalize: NormalizeFn
): void => {
  if (a.type === 'array' && b.type === 'array' && 'items' in a && 'items' in b) {
    if (isRef(a.items) || isRef(b.items)) {
      return
    }

    const aItems = normalize(a.items)
    const bItems = normalize(b.items)
    if (aItems.type && bItems.type && aItems.type !== bItems.type) {
      throw new Error(
        `Cannot merge schemas: array items have conflicting types '${aItems.type}' and '${bItems.type}'`
      )
    }
  }
}
