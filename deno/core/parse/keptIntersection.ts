/**
 * The raw form of an intersection inside a merge: an `allOf` of kept refs
 * (`KeptRefs`) and at most one other schema, which the other members merged
 * into, with only `OWN_KEYWORDS` beside it.
 */

import type { OpenAPIV3 } from 'openapi-types'
import type { KeptRefs } from '@/parse/keptRefs.ts'
import { isRef, toRefParts, toRefPointer } from '@/helpers/refFns.ts'
import { isEmpty } from '@/helpers/isEmpty.ts'
import { hasNullMember } from '@/parse/anyOfSystem.ts'
import { isPlainObject } from '@/parse/isPlainObject.ts'
import { isNullOnly } from '@/parse/v3-0/_merge-all-of/nullable-merge.ts'

type SchemaObject = OpenAPIV3.SchemaObject
type ReferenceObject = OpenAPIV3.ReferenceObject
type SchemaOrReference = SchemaObject | ReferenceObject

/** The keywords of a wrapper that stay beside its `allOf`, out of the merge. `x-*` is one too. */
const OWN_KEYWORDS = ['title', 'description', 'externalDocs', 'example']

/** The keywords that say how the whole value is used. They merge as any keyword, and then are the intersection's own. */
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

/** A schema's keywords that stay beside its `allOf`, and the others. */
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
    others.every(member => !isRef(member) && !Array.isArray(member.allOf))
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
  normalize: (schema: SchemaObject) => SchemaObject
}

/**
 * Merges two schemas where at least one is a kept ref or an intersection: the
 * kept refs stay, and the others merge into one member, at the place of the
 * first of them.
 */
export const mergeKept = ({
  first,
  second,
  keptRefs,
  merge,
  mergeAllOf,
  readRef,
  normalize
}: MergeKeptArgs): SchemaOrReference => {
  const toParts = (schema: SchemaOrReference, other: SchemaOrReference): Intersection => {
    const parts = toIntersectionParts(schema, keptRefs)

    if (parts !== undefined) {
      return { ...parts, members: parts.members.map(member => (isRef(member) ? member : normalize(member))) }
    }

    if (isRef(schema)) {
      // The other side keeps a ref to the same target: the two are one ref.
      const isKept = toIntersectionParts(other, keptRefs)?.members.some(
        member => isRef(member) && isSameTarget(member, schema)
      )

      return isKept ? { own: {}, members: [schema] } : toParts(readRef(schema), other)
    }

    if (schema.allOf?.length === 0) {
      throw new Error('Empty allOf')
    }

    return schema.allOf ? toParts(mergeAllOf(schema), other) : { own: {}, members: [schema] }
  }

  const firstParts = toParts(first, second)
  const secondParts = toParts(second, first)

  const members = secondParts.members.reduce<SchemaOrReference[]>((acc, member) => {
    const index = acc.findIndex(other => (isRef(member) ? isRef(other) && isSameTarget(other, member) : !isRef(other)))
    const other = acc[index]

    if (other === undefined) {
      return [...acc, member]
    }

    const joined =
      isRef(other) && isRef(member)
        ? keptRefs.copy(member, keptRefs.copy(other, { ...other, ...member }))
        : merge(other, member)

    return acc.map((each, at) => (at === index ? joined : each))
  }, firstParts.members.filter(member => !isEmpty(member)))

  return toRawIntersection({ own: { ...firstParts.own, ...secondParts.own }, members })
}

const isSameTarget = (first: ReferenceObject, second: ReferenceObject): boolean =>
  toRefPointer(toRefParts({ $ref: first.$ref })) === toRefPointer(toRefParts({ $ref: second.$ref }))

const toRawIntersection = ({ own, members }: Intersection): SchemaOrReference => {
  const [only] = members

  return isEmpty(own) && members.length === 1 && only !== undefined && isRef(only) ? only : { ...own, allOf: members }
}

type ToSiteIntersectionArgs = Intersection & {
  keptRefs: KeptRefs
}

/**
 * The keywords that a ref to any schema holds as an intersection does. A ref
 * has no `externalDocs`, and checks a `default`, an `example` and `deprecated`
 * against the type of its target.
 */
const isRefKeyword = (key: string): boolean =>
  ['title', 'description', 'nullable', 'readOnly', 'writeOnly'].includes(key) || key.startsWith('x-')

/**
 * The parts of a finished merge, to parse: the keywords that say how the whole
 * value is used move from the one member that is not a ref to the intersection.
 * That member is left out when it then holds only a `type` that the target of
 * a ref beside it declares: it says nothing more than the ref. It stays when it
 * is what rules out the `null` that a target allows and this site does not, or
 * when the one ref that would be left cannot hold what is beside it.
 */
export const toSiteIntersection = ({ own, members, keptRefs }: ToSiteIntersectionArgs): Intersection => {
  const moved = members.map(member => (isRef(member) ? { own: {}, rest: member } : toSiteSplit(member)))

  const site = moved.reduce<SchemaObject>((acc, each) => ({ ...acc, ...each.own }), own)
  const refs = members.filter(isRef)
  const saysNothing = (member: SchemaOrReference): boolean =>
    !isRef(member) &&
    Object.keys(member).every(key => key === 'type') &&
    refs.some(ref => keptRefs.declaresType(ref, member.type)) &&
    (site.nullable === true || !refs.some(keptRefs.allowsNull))

  const present = moved.map(({ rest }) => rest).filter(member => !isEmpty(member))
  const telling = present.filter(member => !saysNothing(member))
  const [only] = telling
  const isLoneRef = telling.length === 1 && only !== undefined && isRef(only)
  const fits = !isLoneRef || (Object.keys(only).length === 1 && Object.keys(site).every(isRefKeyword))

  return { own: site, members: fits ? telling : present }
}

const OBJECT_KEYWORDS = ['required', 'minProperties', 'maxProperties', 'additionalProperties']
const ARRAY_KEYWORDS = ['minItems', 'maxItems', 'uniqueItems']
const STRING_KEYWORDS = ['minLength', 'maxLength', 'pattern']
const NUMBER_KEYWORDS = ['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf']

/**
 * A member with the keywords of one type and no shape (`{ required: ['id'] }`),
 * as that type, and the same for the members of its `oneOf` or `anyOf`: the
 * type was in the kept ref, and a schema with no type loses them.
 */
export const withKeywordType = (member: SchemaOrReference): SchemaOrReference => {
  if (isRef(member) || !isPlainObject(member) || ['type', 'properties', 'items', 'enum'].some(key => key in member)) {
    return member
  }

  if (Array.isArray(member.oneOf) || Array.isArray(member.anyOf)) {
    return {
      ...member,
      ...(Array.isArray(member.oneOf) ? { oneOf: member.oneOf.map(withKeywordType) } : {}),
      ...(Array.isArray(member.anyOf) ? { anyOf: member.anyOf.map(withKeywordType) } : {})
    }
  }

  const hasKeyword = (keywords: string[]): boolean => keywords.some(keyword => keyword in member)

  if (hasKeyword(OBJECT_KEYWORDS)) {
    return { ...member, type: 'object' }
  }

  if (hasKeyword(ARRAY_KEYWORDS)) {
    return { ...member, type: 'array', items: {} }
  }

  if (hasKeyword(STRING_KEYWORDS)) {
    return { ...member, type: 'string' }
  }

  return hasKeyword(NUMBER_KEYWORDS) ? { ...member, type: 'number' } : member
}

/** `schema` with a `null` member of its `oneOf` or `anyOf` written as `nullable`. */
const withoutNullMember = (schema: SchemaObject): SchemaObject =>
  (['oneOf', 'anyOf'] as const).reduce<SchemaObject>((acc, group) => {
    const members = acc[group]

    if (!Array.isArray(members) || !members.every(isPlainObject) || !hasNullMember(members)) {
      return acc
    }

    const { [group]: _group, ...rest } = acc
    const others = members.filter(member => !hasNullMember([member]))

    return { ...rest, ...(others.length > 0 ? { [group]: others } : {}), nullable: true }
  }, schema)

const toSiteSplit = (written: SchemaObject): Split => {
  const member = withoutNullMember(written)

  if (isNullOnly(member)) {
    return { own: { nullable: true }, rest: {} }
  }

  // `null` goes with the `nullable` that moves: the member is not nullable without it.
  const isSite = (key: string): boolean =>
    SITE_KEYWORDS.includes(key) || (key === 'example' && member.example === null && member.nullable === true)
  const { own, rest } = split(member, isSite)

  return member.nullable === true && Array.isArray(rest.enum)
    ? { own, rest: { ...rest, enum: rest.enum.filter((value: unknown) => value !== null) } }
    : { own, rest }
}
