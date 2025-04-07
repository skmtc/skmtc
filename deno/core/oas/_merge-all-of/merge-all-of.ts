import { decomposeAllOf } from './decompose-all-of.ts'
// import { mergeTwoSchemas } from './merge-two-schemas.ts'
import type { GetRefFn, SchemaOrReference, SchemaObject } from './types.ts'
import { mergeSchemasOrRefs } from './merge.ts'
export const mergeAllOf = (schema: SchemaObject, getRef: GetRefFn): SchemaOrReference => {
  const decomposed = decomposeAllOf(schema)

  const dereffed = decomposed.map(decomposed => {
    return '$ref' in decomposed ? getRef(decomposed) : decomposed
  })

  const result = dereffed.reduce<SchemaOrReference>((acc, decomposed) => {
    const merged = mergeSchemasOrRefs(acc, decomposed, getRef)

    return merged
  }, {} as SchemaObject)

  return result
}
