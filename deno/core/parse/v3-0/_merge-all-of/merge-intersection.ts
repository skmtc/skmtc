import { decomposeIntersection } from './decompose-intersection.ts'
import type { GetRefFn, SchemaOrReference, SchemaObject } from './types.ts'
import { mergeSchemasOrRefs } from './merge.ts'
import { derefMember } from './ref-cycle.ts'

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

  // Each member is resolved with its own scoped resolver: one that records the
  // member's `$ref` as being expanded, so anything beneath it pointing back
  // here stays a reference rather than inlining forever.
  const result = decomposed.reduce<SchemaOrReference>((acc, member) => {
    const [value, scoped] = derefMember(member, getRef)

    return mergeSchemasOrRefs(acc, value, scoped)
  }, {} as SchemaObject)

  return result
}
