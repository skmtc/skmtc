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

/** Arguments for {@link isUnknownAnyOf}. */
type IsUnknownAnyOfArgs = {
  /** The `anyOf` members, as the document writes them. */
  members: readonly object[]
  /** `client.json` `system.anyOf`. A test's mock context may have none. */
  setting: 'union' | 'unknown' | undefined
}

/**
 * Whether `system.anyOf: unknown` reads an `anyOf` as any value, as
 * Cloudflare's `cf` reads it: when it has two or more members, not counting a
 * `null` one. An `anyOf` with one member is read as before, so `anyOf: [{
 * $ref }, { type: 'null' }]` stays a nullable reference.
 */
export const isUnknownAnyOf = ({ members, setting }: IsUnknownAnyOfArgs): boolean =>
  setting === 'unknown' && members.filter(member => !isNullMember(member)).length > 1

/** Arguments for {@link withoutUnknownAnyOf}. */
type WithoutUnknownAnyOfArgs = {
  schema: OpenAPIV3.SchemaObject
  /** `client.json` `system.anyOf`. */
  setting: 'union' | 'unknown' | undefined
}

/**
 * `schema` with its other keywords and without an `anyOf` that
 * `system.anyOf: unknown` reads as any value ({@link isUnknownAnyOf}), so the
 * properties next to the `anyOf` stay. A `null` member makes it nullable. Any
 * other schema is returned as it is.
 */
export const withoutUnknownAnyOf = ({ schema, setting }: WithoutUnknownAnyOfArgs): OpenAPIV3.SchemaObject => {
  const members = schema.anyOf ?? []

  if (!isUnknownAnyOf({ members, setting })) {
    return schema
  }

  const { anyOf: _anyOf, ...keywords } = schema

  return hasNullMember(members) ? { ...keywords, nullable: true } : keywords
}

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
