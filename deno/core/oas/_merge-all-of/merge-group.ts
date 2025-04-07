import { decomposeGroup } from './decompose-group.ts'
import type { GetRefFn, SchemaOrReference, SchemaObject } from './types.ts'
import { mergeSchemasOrRefs } from './merge.ts'

type MergeGroupArgs = {
  schema: SchemaObject
  getRef: GetRefFn
  groupType: 'oneOf' | 'anyOf' | 'allOf'
}

export const mergeGroup = ({ schema, getRef, groupType }: MergeGroupArgs): SchemaOrReference => {
  const decomposed = decomposeGroup({ schema, groupType })

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
