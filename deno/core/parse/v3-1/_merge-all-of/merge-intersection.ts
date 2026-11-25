import { decomposeIntersection } from './decompose-intersection.ts'
import type { GetRefFn, NormalizeFn, SchemaOrReference, SchemaObject, MergeSystem } from './types.ts'
import { mergeSchemasOrRefs } from './merge.ts'
import { isEmpty } from '@/helpers/isEmpty.ts'
import { splitOwnKeywords, withOwnKeywords } from '@/parse/keptIntersection.ts'

type MergeIntersectionArgs = {
  schema: SchemaObject
  getRef: GetRefFn
  normalize: NormalizeFn
  system: MergeSystem
  throwOnConflict?: boolean
}

export const mergeIntersection = ({
  schema,
  getRef,
  normalize,
  system
}: MergeIntersectionArgs): SchemaOrReference => {
  // Where a ref stays a ref, the wrapper's own keywords stay beside the `allOf`.
  const { own, rest } = system.keptRefs?.holds(schema) ? splitOwnKeywords(schema) : { own: {}, rest: schema }
  const decomposed = decomposeIntersection({ schema: rest })

  if (decomposed.length === 1 && isEmpty(own)) {
    return decomposed[0]
  }

  const dereffed = decomposed.map(decomposed => {
    return '$ref' in decomposed && !system.keptRefs?.has(decomposed) ? getRef(decomposed) : decomposed
  })

  const result = dereffed.reduce<SchemaOrReference>((acc, decomposed) => {
    const merged = mergeSchemasOrRefs({ first: acc, second: decomposed, getRef, normalize, system })

    return merged
  }, {} as SchemaObject)

  return withOwnKeywords(result, own)
}
