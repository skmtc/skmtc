import { decomposeIntersection } from './decompose-intersection.ts'
import type { GetRefFn, SchemaOrReference, SchemaObject } from './types.ts'
import { mergeSchemasOrRefs } from './merge.ts'
import { isExpanding, whileExpanding } from './ref-expansion.ts'

type MergeIntersectionArgs = {
  schema: SchemaObject
  getRef: GetRefFn
  throwOnConflict?: boolean
}

export const mergeIntersection = ({ schema, getRef }: MergeIntersectionArgs): SchemaOrReference => {
  const decomposed = decomposeIntersection({ schema })

  if (decomposed.length === 1) {
    return decomposed[0]
  }

  // Dereferencing happens INSIDE the reduce rather than in a prior `map` so
  // each member stays paired with the `$ref` it came from: a ref counts as open
  // for the whole of its own expansion, which is where the cycle would recur.
  const result = decomposed.reduce<SchemaOrReference>((acc, member) => {
    if (!('$ref' in member)) {
      return mergeSchemasOrRefs(acc, member, getRef)
    }

    // Already an ancestor of itself — expanding again cannot terminate, and it
    // adds nothing the outer expansion has not already contributed.
    if (isExpanding(member)) {
      return acc
    }

    return whileExpanding(member, () => mergeSchemasOrRefs(acc, getRef(member), getRef))
  }, {} as SchemaObject)

  return result
}
