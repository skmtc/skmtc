import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContextType } from '@/context/parseTypes.ts'
import type { StackTrail } from '@/context/StackTrail.ts'

/**
 * Whether an `anyOf` member is only `null`: 3.0's `{ nullable: true, enum:
 * [null] }`, or 3.1's `{ type: 'null' }`.
 */
const isNullMember = (member: object): boolean => {
  const fields: Record<string, unknown> = Object.fromEntries(Object.entries(member))
  const values = fields.enum

  return (
    fields.type === 'null' ||
    (fields.nullable === true && Array.isArray(values) && values.length === 1 && values[0] === null)
  )
}

/** Whether one of the members of an `anyOf` is only `null`. */
export const hasNullMember = (members: readonly object[]): boolean => members.some(isNullMember)

/** The types of a single value: a member of one of them is a scalar. */
const SCALAR_TYPES: readonly unknown[] = ['string', 'number', 'integer', 'boolean']

/** The JavaScript types of a scalar enum value. */
const SCALAR_VALUE_TYPES: readonly string[] = ['string', 'number', 'boolean']

/**
 * Whether an `anyOf` member, followed through its references, is a single
 * value: its `type` is a string, number, integer or boolean (besides `null`),
 * or it has no `type` and an `enum` of such values.
 */
const isScalarMember = (member: object): boolean => {
  const fields: Record<string, unknown> = Object.fromEntries(Object.entries(member))
  const types = Array.isArray(fields.type) ? fields.type.filter(type => type !== 'null') : [fields.type]

  if (fields.type !== undefined) {
    return types.length > 0 && types.every(type => SCALAR_TYPES.includes(type))
  }

  return (
    Array.isArray(fields.enum) &&
    fields.enum.every(value => value === null || SCALAR_VALUE_TYPES.includes(typeof value))
  )
}

/** Follows a member through its references, to the schema it names. Stops after 10 steps, at a cycle. */
const toMemberSchema = (
  member: OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject,
  getRef: GetRefFn,
  steps = 0
): OpenAPIV3.SchemaObject | undefined => {
  if (!('$ref' in member)) {
    return member
  }

  return steps < 10 ? toMemberSchema(getRef(member), getRef, steps + 1) : undefined
}

/** Follows a reference to the schema it names, as the parsers' `GetRefFn` does. */
type GetRefFn = (ref: OpenAPIV3.ReferenceObject) => OpenAPIV3.SchemaObject

/** Arguments for {@link isUnknownAnyOf}. */
type IsUnknownAnyOfArgs = {
  /** The `anyOf` members, as the document writes them. */
  members: readonly (OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject)[]
  /** `client.json` `system.anyOf`. A test's mock context may have none. */
  setting: 'union' | 'unknown' | undefined
  getRef: GetRefFn
}

/**
 * Whether `system.anyOf: unknown` reads an `anyOf` as any value, as
 * Cloudflare's `cf` reads it: when it has two or more members, not counting a
 * `null` one, and one of them is not a single value.
 *
 * - An `anyOf` with one member is read as before, so `anyOf: [{ $ref }, {
 *   type: 'null' }]` stays a nullable reference.
 * - An `anyOf` of single values stays a union (`string | number`): cf gives
 *   it one flag.
 */
export const isUnknownAnyOf = ({ members, setting, getRef }: IsUnknownAnyOfArgs): boolean => {
  if (setting !== 'unknown') {
    return false
  }

  const values = members.filter(member => !isNullMember(member)).map(member => toMemberSchema(member, getRef))

  return values.length > 1 && !values.every(value => value !== undefined && isScalarMember(value))
}

/** Arguments for {@link withoutUnknownAnyOf}. */
type WithoutUnknownAnyOfArgs = {
  schema: OpenAPIV3.SchemaObject
  /** `client.json` `system.anyOf`. */
  setting: 'union' | 'unknown' | undefined
  getRef: GetRefFn
}

/**
 * `schema` with its other keywords and without an `anyOf` that
 * `system.anyOf: unknown` reads as any value ({@link isUnknownAnyOf}), so the
 * properties next to the `anyOf` stay. A `null` member makes it nullable. Any
 * other schema is returned as it is.
 */
export const withoutUnknownAnyOf = ({ schema, setting, getRef }: WithoutUnknownAnyOfArgs): OpenAPIV3.SchemaObject => {
  const members = schema.anyOf ?? []

  if (!isUnknownAnyOf({ members, setting, getRef })) {
    return schema
  }

  const { anyOf: _anyOf, ...keywords } = schema

  return hasNullMember(members) ? { ...keywords, nullable: true } : keywords
}

/** The keywords that give a schema its own shape, so it is more than any value. */
const SHAPE_KEYWORDS: readonly string[] = [
  'type',
  'properties',
  'additionalProperties',
  'items',
  'enum',
  'const',
  'allOf',
  'oneOf',
  '$ref'
]

/**
 * Whether the keywords that are left when an `anyOf` is read as any value
 * ({@link withoutUnknownAnyOf}) give the schema a shape of its own:
 * `properties` next to the `anyOf` do. A `default`, an `example` or a
 * `format` alone does not. The parser must not guess a type from them, as it
 * does for a schema that has no type (`MISSING_STRING_TYPE`): the members
 * were the type, and they are gone.
 */
export const hasShapeKeyword = (schema: object): boolean => SHAPE_KEYWORDS.some(keyword => keyword in schema)

/** Arguments for {@link logUnknownAnyOf}. */
type LogUnknownAnyOfArgs = {
  /** The trail of the schema whose `anyOf` was read as any value. */
  stackTrail: StackTrail
  parent: unknown
  context: ParseContextType
}

/** Arguments for {@link logMergedUnknownAnyOf}. */
type LogMergedUnknownAnyOfArgs = LogUnknownAnyOfArgs & {
  /** The merge's `system`: `unknown` holds `anyOf` when the merge read one as any value. */
  system: { unknown: Set<string> }
}

/** One warning for a schema whose merge read an `anyOf` as any value. Nothing when it read none. */
export const logMergedUnknownAnyOf = ({ system, stackTrail, parent, context }: LogMergedUnknownAnyOfArgs): void => {
  if (system.unknown.has('anyOf')) {
    logUnknownAnyOf({ stackTrail, parent, context })
  }
}

/** One warning for a schema whose `anyOf` was read as any value (`system.anyOf: unknown`). */
export const logUnknownAnyOf = ({ stackTrail, parent, context }: LogUnknownAnyOfArgs): void => {
  context.logIssueNoKey({
    level: 'warning',
    message:
      'The anyOf is read as any value (system.anyOf is unknown): the schema keeps its other keywords, without the anyOf members.',
    parent,
    stackTrail,
    type: 'ANYOF_AS_UNKNOWN'
  })
}
