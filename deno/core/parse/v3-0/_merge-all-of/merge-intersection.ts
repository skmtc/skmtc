import { decomposeIntersection } from './decompose-intersection.ts'
import type { GetRefFn, SchemaOrReference, SchemaObject } from './types.ts'
import { mergeSchemasOrRefs } from './merge.ts'
import { isRef, toRefName } from '@/helpers/refFns.ts'

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

  // Resolve the bases BEFORE putting them on the chain: a base that is
  // already on it is a cycle, and the resolver is what says so.
  const dereffed = decomposed.map(decomposed => {
    return '$ref' in decomposed ? getRef(decomposed, 'base') : decomposed
  })

  const merge = (): SchemaOrReference => {
    return dereffed.reduce<SchemaOrReference>((acc, decomposed) => {
      return mergeSchemasOrRefs(acc, decomposed, getRef)
    }, {} as SchemaObject)
  }

  // The bases stay on the chain for the WHOLE merge, not just their own
  // dereference: their content takes part in every later step, and a cycle
  // back into one of them from there is still a cycle.
  const baseNames = decomposed.filter(isRef).map(member => toRefName(member.$ref))
  const chained = () => (getRef.withChain ? getRef.withChain(baseNames, merge) : merge())

  // When this `allOf` belongs to a schema that was copied in, the merge is
  // that schema's own elimination: a base met inside it that is the same
  // schema is a cycle, whereas the same name as a sibling base is not.
  const owner = Array.isArray(schema.allOf) ? getRef.ownerOf?.(schema.allOf) : undefined

  return owner !== undefined && getRef.withEliminating
    ? getRef.withEliminating(owner, chained)
    : chained()
}
