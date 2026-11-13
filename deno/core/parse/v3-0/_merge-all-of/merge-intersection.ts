import { decomposeIntersection } from './decompose-intersection.ts'
import type { GetRefFn, SchemaOrReference, SchemaObject, MergeSystem } from './types.ts'
import { mergeSchemasOrRefs } from './merge.ts'

type MergeIntersectionArgs = {
  schema: SchemaObject
  getRef: GetRefFn
  system: MergeSystem
  throwOnConflict?: boolean
}

export const mergeIntersection = ({ schema, getRef, system }: MergeIntersectionArgs): SchemaOrReference => {
  const decomposed = decomposeIntersection({ schema })

  if (decomposed.length === 1) {
    return decomposed[0]
  }

  const dereffed = decomposed.map(decomposed => {
    return '$ref' in decomposed ? getRef(decomposed) : decomposed
  })

  const result = dereffed.reduce<SchemaOrReference>((acc, decomposed) => {
    const merged = mergeSchemasOrRefs({ first: acc, second: decomposed, getRef, system })

    return merged
  }, {} as SchemaObject)

  return result
}
