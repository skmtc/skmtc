/**
 * The raw form of an intersection inside a merge: an `allOf` of kept refs
 * (`KeptRefs`) and at most one other schema, which the other members merged
 * into, with only the intersection's own keywords beside it.
 */

import type { OpenAPIV3 } from 'openapi-types'
import type { KeptRefs } from '@/parse/keptRefs.ts'
import { isRef, toRefParts, toRefPointer } from '@/helpers/refFns.ts'
import { isEmpty } from '@/helpers/isEmpty.ts'
import { isNullOnly } from '@/parse/v3-0/_merge-all-of/nullable-merge.ts'

type SchemaObject = OpenAPIV3.SchemaObject
type ReferenceObject = OpenAPIV3.ReferenceObject
type SchemaOrReference = SchemaObject | ReferenceObject

/** The keywords an `OasIntersection` has itself. `x-*` is one too. */
const OWN_KEYWORDS = [
  'title',
  'description',
  'externalDocs',
  'example',
  'nullable',
  'readOnly',
  'writeOnly',
  'deprecated',
  'default'
]

/** The own keywords that say how the whole value is used, so they move from a member to the intersection. */
const SITE_KEYWORDS = ['nullable', 'readOnly', 'writeOnly', 'deprecated', 'default']

const isOwnKeyword = (key: string): boolean => OWN_KEYWORDS.includes(key) || key.startsWith('x-')

type Split = { own: SchemaObject; rest: SchemaObject }

const split = (schema: SchemaObject, isOwn: (key: string) => boolean): Split => {
  const entries = Object.entries(schema)

  return {
    own: Object.fromEntries(entries.filter(([key]) => isOwn(key))),
    rest: Object.fromEntries(entries.filter(([key]) => !isOwn(key)))
  }
}

/** A schema's keywords that an intersection has itself, and the others. */
export const splitOwnKeywords = (schema: SchemaObject): Split => split(schema, isOwnKeyword)

/** A merge result with the wrapper's own keywords, which win, put back on it. */
export const withOwnKeywords = (merged: SchemaOrReference, own: SchemaObject): SchemaOrReference => {
  if (isEmpty(own)) {
    return merged
  }

  return isRef(merged) ? { ...own, allOf: [merged] } : { ...merged, ...own }
}

type Intersection = { own: SchemaObject; members: SchemaOrReference[] }

/** The parts of a kept ref, or of a schema in the raw form of an intersection; `undefined` for any other schema. */
export const toIntersectionParts = (schema: SchemaOrReference, keptRefs: KeptRefs): Intersection | undefined => {
  if (isRef(schema)) {
    return keptRefs.has(schema) ? { own: {}, members: [schema] } : undefined
  }

  if (!Array.isArray(schema.allOf)) {
    return undefined
  }

  const { allOf, ...keywords } = schema
  const isKept = (member: SchemaOrReference): boolean => isRef(member) && keptRefs.has(member)
  const others = allOf.filter(member => !isKept(member))

  return Object.keys(keywords).every(isOwnKeyword) &&
    allOf.some(isKept) &&
    others.length <= 1 &&
    others.every(member => !isRef(member) && !('allOf' in member))
    ? { own: keywords, members: allOf }
    : undefined
}

type MergeKeptArgs = {
  first: SchemaOrReference
  second: SchemaOrReference
  keptRefs: KeptRefs
  /** Merges two schemas that hold no kept ref. */
  merge: (first: SchemaOrReference, second: SchemaOrReference) => SchemaOrReference
  /** Merges a schema's own `allOf`. */
  mergeAllOf: (schema: SchemaObject) => SchemaOrReference
  readRef: (ref: ReferenceObject) => SchemaObject
}

/**
 * Merges two schemas where at least one is a kept ref or an intersection: the
 * kept refs stay, and the others merge into one member, at the place of the
 * first of them.
 */
export const mergeKept = ({ first, second, keptRefs, merge, mergeAllOf, readRef }: MergeKeptArgs): SchemaOrReference => {
  const toParts = (schema: SchemaOrReference): Intersection => {
    const parts = toIntersectionParts(schema, keptRefs)

    if (parts !== undefined) {
      return parts
    }

    if (isRef(schema)) {
      return toParts(readRef(schema))
    }

    return schema.allOf?.length ? toParts(mergeAllOf(schema)) : { own: {}, members: [schema] }
  }

  const firstParts = toParts(first)
  const secondParts = toParts(second)

  const members = secondParts.members.reduce<SchemaOrReference[]>((acc, member) => {
    const index = acc.findIndex(other => (isRef(member) ? isRef(other) && isSameTarget(other, member) : !isRef(other)))
    const other = acc[index]

    if (other === undefined) {
      return [...acc, member]
    }

    const joined =
      isRef(other) && isRef(member)
        ? keptRefs.copy(other, { ...other, ...member })
        : merge(other, member)

    return acc.map((each, at) => (at === index ? joined : each))
  }, firstParts.members.filter(member => !isEmpty(member)))

  return toRawIntersection({ own: { ...firstParts.own, ...secondParts.own }, members })
}

const isSameTarget = (first: ReferenceObject, second: ReferenceObject): boolean =>
  toRefPointer(toRefParts({ $ref: first.$ref })) === toRefPointer(toRefParts({ $ref: second.$ref }))

const toRawIntersection = ({ own, members }: Intersection): SchemaOrReference => {
  const moved = members.map(member => {
    if (isRef(member)) {
      return { own: {}, member }
    }

    if (isNullOnly(member)) {
      return { own: { nullable: true }, member: {} }
    }

    const { own: site, rest } = split(member, key => SITE_KEYWORDS.includes(key))

    return { own: site, member: rest }
  })

  const keywords = moved.reduce<SchemaObject>((acc, { own: site }) => ({ ...acc, ...site }), own)
  const kept = moved.map(({ member }) => member).filter(member => !isEmpty(member))
  const [only] = kept

  return isEmpty(keywords) && kept.length === 1 && only !== undefined && isRef(only)
    ? only
    : { ...keywords, allOf: kept }
}
