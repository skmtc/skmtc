import { decomposeUnion } from './decompose-union.ts'
import type { GetRefFn, SchemaOrReference, SchemaObject } from './types.ts'
import { mergeSchemasOrRefs } from './merge.ts'
import { crossProduct } from './cross-product.ts'
import { derefMember } from './ref-cycle.ts'
import { isRef } from '@/helpers/refFns.ts'
type MergeUnionArgs = {
  schema: SchemaObject
  getRef: GetRefFn
  groupType: 'oneOf' | 'anyOf'
}

export const mergeUnion = ({ schema, getRef, groupType }: MergeUnionArgs): SchemaOrReference => {
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

  const result = decomposed.reduce<SchemaObject>((acc, member) => {
    const [value, scoped] = derefMember(member, getRef)

    return mergeCrossProduct({ first: acc, second: value, getRef: scoped, groupType })
  }, {} as SchemaObject)

  const output = {
    ...beforeExcluded,
    ...result,
    ...afterExcluded
  }

  return output
}

type MergeCrossProductArgs = {
  first: SchemaOrReference
  second: SchemaOrReference
  getRef: GetRefFn
  groupType: 'oneOf' | 'anyOf'
}

/**
 * A schema's union members, or the schema itself when it is not a union. A
 * reference is never a union — it is one member, resolved later.
 */
const toGroup = (schema: SchemaOrReference, groupType: 'oneOf' | 'anyOf'): SchemaOrReference[] => {
  if (isRef(schema)) {
    return [schema]
  }

  const group = schema[groupType]

  return Array.isArray(group) ? group : [schema]
}

export const mergeCrossProduct = ({
  first,
  second,
  getRef,
  groupType
}: MergeCrossProductArgs): SchemaObject => {
  const mergedGroup = crossProduct(toGroup(first, groupType), toGroup(second, groupType))
    .map(([firstItem, secondItem]) => {
      try {
        const result = mergeSchemasOrRefs(firstItem, secondItem, getRef)

        return result
      } catch (error) {
        // Dropping a branch on a genuine conflict is the design: a cross
        // product legitimately contains impossible combinations. A RangeError
        // is not that — it is the recursion running away, and swallowing it
        // turned a fast stack overflow into a very long exponential search
        // with union members silently vanishing. Let it out.
        if (error instanceof RangeError) {
          throw error
        }

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
