import { decomposeUnion } from './decompose-union.ts'
import type { GetRefFn, SchemaOrReference, SchemaObject, MergeSystem } from './types.ts'
import { mergeSchemasOrRefs } from './merge.ts'
import { crossProduct } from './cross-product.ts'
import { isRef } from '@/helpers/refFns.ts'
import { DanglingRefError } from '@/oas/ref/DanglingRefError.ts'
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

/**
 * The `system` a member's own `allOf` merges under: the `client.json`
 * setting, also in the first pass over a cross product's pairs.
 */
export const toOwnSystem = (system: MergeSystem): MergeSystem => ({
  ...system,
  allOf: system.setting ?? system.allOf,
  setting: undefined
})

/** Arguments for {@link mergePairs}. */
type MergePairsArgs = {
  pairs: [SchemaOrReference, SchemaOrReference][]
  /** Merges one pair of the cross product under `pairSystem`. */
  merge: (pair: [SchemaOrReference, SchemaOrReference], pairSystem: MergeSystem) => SchemaOrReference
  system: MergeSystem
}

/**
 * The merge of each pair of the cross product whose members do not
 * contradict. Such a pair is no value of the union, so it is left out, as
 * under `strict`. Only when every pair contradicts does `latestWins` merge
 * them again, the later member winning, without duplicates: Cloudflare's
 * collections say `result` is an object or a string, then an array.
 *
 * The first pass is strict between the two members of a pair only. A
 * member's own `allOf` merges under the `client.json` setting
 * ({@link toOwnSystem}). Inside an outer first pass under `latestWins`, a
 * cross product with no pair that merges fails its pair: the outer pass then
 * leaves the pair out, or lets the later member win.
 *
 * A `$ref` that names nothing is not a contradiction, so its pair is not left
 * out for it: the `DanglingRefError` is thrown on, and `system.danglingRefs`
 * decides (`allOfMember`).
 */
const mergePairs = ({ pairs, merge, system }: MergePairsArgs): SchemaOrReference[] => {
  const mergeEach = (pairSystem: MergeSystem): SchemaOrReference[] =>
    pairs.flatMap(pair => {
      try {
        return [merge(pair, pairSystem)]
      } catch (error) {
        if (DanglingRefError.is(error)) {
          throw error
        }

        return []
      }
    })

  const strict = mergeEach({ ...system, allOf: 'strict', setting: system.setting ?? system.allOf })

  if (strict.length > 0) {
    return strict
  }

  if (system.allOf === 'strict' && system.setting === 'latestWins') {
    throw new Error('No pair of the cross product merges')
  }

  if (system.allOf === 'strict') {
    return strict
  }

  const latest = mergeEach(system).map(item => ({ item, key: JSON.stringify(item) }))

  return latest.filter(({ key }, index) => latest.findIndex(other => other.key === key) === index).map(({ item }) => item)
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

  const mergedGroup = mergePairs({
    pairs: crossProduct(firstGroup, secondGroup),
    merge: ([firstItem, secondItem], pairSystem) => {
      // A kept ref is not read into the merge, so its type is compared here.
      if (pairSystem.allOf === 'strict' && system.keptRefs?.contradict(firstItem, secondItem)) {
        throw new Error('Cannot merge schemas: a member has another type than the reference')
      }

      return mergeSchemasOrRefs({ first: firstItem, second: secondItem, getRef, system: pairSystem })
    },
    system
  })

  return {
    [groupType]: mergedGroup.flatMap(item => {
      if (!isRef(item) && Array.isArray(item[groupType])) {
        return item[groupType]
      }

      return [item]
    })
  }
}
