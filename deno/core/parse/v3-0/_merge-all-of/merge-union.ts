import { decomposeUnion } from './decompose-union.ts'
import type { GetRefFn, SchemaOrReference, SchemaObject, MergeSystem } from './types.ts'
import { mergeSchemasOrRefs } from './merge.ts'
import { crossProduct } from './cross-product.ts'
import { isRef } from '@/helpers/refFns.ts'
type MergeUnionArgs = {
  schema: SchemaObject
  getRef: GetRefFn
  system: MergeSystem
  groupType: 'oneOf' | 'anyOf'
}

export const mergeUnion = ({ schema, getRef, system, groupType }: MergeUnionArgs): SchemaOrReference => {
  const { beforeExcluded, decomposed, afterExcluded } = decomposeUnion({ schema, groupType })

  // if (decomposed.length === 1) {
  //   console.log('DECOMPOSED', JSON.stringify(decomposed[0], null, 2))
  //   const result = {
  //     ...beforeExcluded,
  //     ...decomposed[0],
  //     ...afterExcluded
  //   }

  //   console.log('MERGED UNION - SHORT', JSON.stringify(result, null, 2))

  //   return result
  // }

  const dereffed = decomposed.map(decomposed => {
    return '$ref' in decomposed ? getRef(decomposed) : decomposed
  })

  const result = dereffed.reduce<SchemaObject>((acc, decomposed) => {
    const merged = mergeCrossProduct({ first: acc, second: decomposed, getRef, system, groupType })

    return merged
  }, {} as SchemaObject)

  const output = {
    ...beforeExcluded,
    ...result,
    ...afterExcluded
  }

  return output
}

type MergeCrossProductArgs = {
  first: SchemaObject
  second: SchemaObject
  getRef: GetRefFn
  system: MergeSystem
  groupType: 'oneOf' | 'anyOf'
}

export const mergeCrossProduct = ({
  first,
  second,
  getRef,
  system,
  groupType
}: MergeCrossProductArgs): SchemaObject => {
  const firstGroup = Array.isArray(first[groupType]) ? first[groupType] : [first]
  const secondGroup = Array.isArray(second[groupType]) ? second[groupType] : [second]

  const mergedGroup = crossProduct(firstGroup, secondGroup)
    .map(([firstItem, secondItem]) => {
      try {
        const result = mergeSchemasOrRefs({ first: firstItem, second: secondItem, getRef, system })

        return result
      } catch (_error) {
        return undefined
      }
    })
    .filter(item => item !== undefined)

  return {
    [groupType]: mergedGroup.flatMap(item => {
      if (!isRef(item) && Array.isArray(item[groupType])) {
        return item[groupType]
      }

      return [item]
    })
  }
}
