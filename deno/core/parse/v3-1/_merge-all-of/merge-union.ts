import { decomposeUnion, isUnionLevelKey } from './decompose-union.ts'
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

  const mergedGroup = crossProduct(
    withGroupSiblings({ schema: first, members: firstGroup, getRef, normalize, groupType }),
    withGroupSiblings({ schema: second, members: secondGroup, getRef, normalize, groupType })
  )
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

type WithGroupSiblingsArgs = {
  schema: SchemaObject
  members: SchemaOrReference[]
  getRef: GetRefFn
  normalize: NormalizeFn
  groupType: 'oneOf' | 'anyOf'
}

/**
 * Merge the sibling keys of a `oneOf`/`anyOf` wrapper into each of its
 * `members`. A 3.1 `type: ['string', 'number']` with `minLength` normalizes
 * to a `oneOf` with `minLength` beside it. Union-level keys (`nullable`,
 * `description`, …) are not merged in. A member that conflicts with the
 * siblings is dropped, as in the cross product. A schema with no group is
 * its own only member and is returned unchanged.
 */
const withGroupSiblings = ({
  schema,
  members,
  getRef,
  normalize,
  groupType
}: WithGroupSiblingsArgs): SchemaOrReference[] => {
  if (!Array.isArray(schema[groupType])) {
    return members
  }

  const siblings: [string, unknown][] = Object.entries(schema).filter(
    ([key]) => key !== groupType && !isUnionLevelKey(key)
  )

  if (siblings.length === 0) {
    return members
  }

  const siblingSchema: SchemaObject = Object.fromEntries(siblings)

  return members
    .map(member => {
      try {
        return mergeSchemasOrRefs(siblingSchema, member, getRef, normalize)
      } catch (_error) {
        return undefined
      }
    })
    .filter(member => member !== undefined)
}

const isNullableOnly = (member: SchemaOrReference, normalize: NormalizeFn): boolean => {
  if (isRef(member)) {
    return false
  }

  const normalized = collapseNullOnlyUnion(normalize(member), normalize)

  return normalized.nullable === true && Object.keys(normalized).length === 1
}

/**
 * A `oneOf`/`anyOf` whose every member is null-only (for example
 * `oneOf: [{ type: 'null' }]`) reads as nullable with no other type, not
 * as an empty union: the group is replaced by `nullable: true`. Any other
 * schema is returned unchanged.
 */
export const collapseNullOnlyUnion = (
  schema: SchemaObject,
  normalize: NormalizeFn
): SchemaObject => {
  const isNullOnlyGroup = (members: SchemaOrReference[] | undefined): boolean =>
    Array.isArray(members) &&
    members.length > 0 &&
    members.every(member => isNullableOnly(member, normalize))

  if (isNullOnlyGroup(schema.oneOf)) {
    const { oneOf: _oneOf, ...rest } = schema

    return { ...rest, nullable: true }
  }

  if (isNullOnlyGroup(schema.anyOf)) {
    const { anyOf: _anyOf, ...rest } = schema

    return { ...rest, nullable: true }
  }

  return schema
}

/** Is this a `oneOf`/`anyOf` group wrapper that already carries `nullable`? */
const isNullableGroup = (schema: SchemaObject, groupType: 'oneOf' | 'anyOf'): boolean =>
  Array.isArray(schema[groupType]) && schema.nullable === true
