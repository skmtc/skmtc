import { decomposeUnion } from './decompose-union.ts'
import type { GetRefFn, NormalizeFn, SchemaOrReference, SchemaObject } from './types.ts'
import { mergeSchemasOrRefs } from './merge.ts'
import { crossProduct } from './cross-product.ts'
import { isRef } from '@/helpers/refFns.ts'
type MergeUnionArgs = {
  schema: SchemaObject
  getRef: GetRefFn
  normalize: NormalizeFn
  groupType: 'oneOf' | 'anyOf'
}

export const mergeUnion = ({
  schema,
  getRef,
  normalize,
  groupType
}: MergeUnionArgs): SchemaOrReference => {
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
    const merged = mergeCrossProduct({
      first: acc,
      second: decomposed,
      getRef,
      normalize,
      groupType
    })

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
  normalize: NormalizeFn
  groupType: 'oneOf' | 'anyOf'
}

export const mergeCrossProduct = ({
  first,
  second,
  getRef,
  normalize,
  groupType
}: MergeCrossProductArgs): SchemaObject => {
  const firstMembers = Array.isArray(first[groupType]) ? first[groupType] : [first]
  const secondMembers = Array.isArray(second[groupType]) ? second[groupType] : [second]

  // A member that normalizes to exactly `{ nullable: true }` is a null-only
  // member: it makes the union nullable instead of joining the cross product.
  const firstGroup = firstMembers.filter(member => !isNullableOnly(member, normalize))
  const secondGroup = secondMembers.filter(member => !isNullableOnly(member, normalize))

  const nullable =
    isNullableGroup(first, groupType) ||
    isNullableGroup(second, groupType) ||
    firstGroup.length !== firstMembers.length ||
    secondGroup.length !== secondMembers.length

  const mergedGroup = crossProduct(firstGroup, secondGroup)
    .map(([firstItem, secondItem]) => {
      try {
        const result = mergeSchemasOrRefs(firstItem, secondItem, getRef, normalize)

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
    }),
    ...(nullable ? { nullable: true } : {})
  }
}

const isNullableOnly = (member: SchemaOrReference, normalize: NormalizeFn): boolean => {
  if (isRef(member)) {
    return false
  }

  const normalized = normalize(member)

  return normalized.nullable === true && Object.keys(normalized).length === 1
}

/** Is this a `oneOf`/`anyOf` group wrapper that already carries `nullable`? */
const isNullableGroup = (schema: SchemaObject, groupType: 'oneOf' | 'anyOf'): boolean =>
  Array.isArray(schema[groupType]) && schema.nullable === true
