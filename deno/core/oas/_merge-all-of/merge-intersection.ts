import { decomposeIntersection } from './decompose-intersection.ts'
import type { GetRefFn, SchemaOrReference, SchemaObject } from './types.ts'
import { mergeSchemasOrRefs } from './merge.ts'

type MergeIntersectionArgs = {
  schema: SchemaObject
  getRef: GetRefFn
}

export const mergeIntersection = ({ schema, getRef }: MergeIntersectionArgs): SchemaOrReference => {
  const decomposed = decomposeIntersection({ schema })

  if (decomposed.length === 1) {
    return decomposed[0]
  }

  const dereffed = decomposed.map(decomposed => {
    return '$ref' in decomposed ? getRef(decomposed) : decomposed
  })

  const result = dereffed.reduce<SchemaOrReference>((acc, decomposed) => {
    const merged = mergeSchemasOrRefs(acc, decomposed, getRef)

    return merged
  }, {} as SchemaObject)

  return result
}
