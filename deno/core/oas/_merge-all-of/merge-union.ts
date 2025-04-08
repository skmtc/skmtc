import { decomposeUnion } from './decompose-union.ts'
import type { GetRefFn, SchemaOrReference, SchemaObject } from './types.ts'
import { mergeSchemasOrRefs } from './merge.ts'
import { crossProduct } from './cross-product.ts'
type MergeUnionArgs = {
  schema: SchemaObject
  getRef: GetRefFn
  groupType: 'oneOf' | 'anyOf'
}

export const mergeUnion = ({ schema, getRef, groupType }: MergeUnionArgs): SchemaOrReference => {
  const { beforeExcluded, decomposed, afterExcluded } = decomposeUnion({ schema, groupType })

  console.log('DECOMPOSED', JSON.stringify(decomposed, null, 2))

  if (decomposed.length === 1) {
    return {
      ...beforeExcluded,
      ...decomposed[0],
      ...afterExcluded
    }
  }

  const dereffed = decomposed.map(decomposed => {
    return '$ref' in decomposed ? getRef(decomposed) : decomposed
  })

  const result = dereffed.reduce<SchemaObject>((acc, decomposed) => {
    const merged = mergeCrossProduct({ first: acc, second: decomposed, getRef, groupType })

    return merged
  }, {} as SchemaObject)

  return result
}

type MergeCrossProductArgs = {
  first: SchemaObject
  second: SchemaObject
  getRef: GetRefFn
  groupType: 'oneOf' | 'anyOf'
}

export const mergeCrossProduct = ({
  first,
  second,
  getRef,
  groupType
}: MergeCrossProductArgs): SchemaObject => {
  const firstGroup = Array.isArray(first[groupType]) ? first[groupType] : [first]
  const secondGroup = Array.isArray(second[groupType]) ? second[groupType] : [second]

  const mergedGroup = crossProduct(firstGroup, secondGroup)
    .map(([firstItem, secondItem]) => {
      try {
        const result = mergeSchemasOrRefs(firstItem, secondItem, getRef)

        return result
      } catch (_error) {
        return undefined
      }
    })
    .filter(item => item !== undefined)

  return {
    [groupType]: mergedGroup
  }
}
