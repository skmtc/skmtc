import type { OasSchema } from '@/oas/schema/Schema.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import type { OasUnion } from '@/oas/union/Union.ts'
import type { SchemaPath } from '@/types/SchemaPath.ts'
import { toRefName } from '@/helpers/refFns.ts'

/**
 * Walk an {@link SchemaPath} into a schema, resolving `$ref`s as it descends.
 *
 * The shared engine behind `OasOperation.traverse` and every `OasSchema`
 * variant's `traverse`. A ref — or a `OasSchema | OasRef<'schema'>` union value —
 * is passed straight to this function, which resolves refs itself, so `OasRef`
 * needs no `traverse` method of its own. Navigation rules per segment, keyed by
 * the schema currently under the cursor:
 *
 * - **empty path** → returns `value` unchanged (it may still be a ref — the
 *   final value is never force-resolved, so a target's refName survives).
 * - **object** → the segment is a property name; descends into
 *   `properties[segment]`.
 * - **array** → the segment must be the literal `'items'`; descends into the
 *   element schema.
 * - **union** → the segment selects a member ({@link selectUnionMember}):
 *   `'$Circle'` by refName, `'{type:circle}'` by discriminator, `'[0]'` by index.
 *
 * A ref is resolved only when the path needs to descend *through* it. Anything
 * the path cannot navigate throws a descriptive, segment-named error: a missing
 * property, a {@link import('@/dsl/CustomValue.ts').CustomValue} property, a
 * non-`'items'` segment on an array, a union member that doesn't match, or
 * descending into a scalar.
 *
 * @throws Error when a segment cannot be navigated.
 */
export const traverseSchema = (
  value: OasSchema | OasRef<'schema'>,
  path: SchemaPath
): OasSchema | OasRef<'schema'> => {
  if (path.length === 0) {
    return value
  }

  // Resolve refs only to descend through them; the final value (path empty,
  // above) is returned as-is.
  const schema = value.isRef() ? value.resolve() : value
  const [segment, ...rest] = path

  switch (schema.type) {
    case 'object': {
      const property = schema.properties?.[segment]

      if (!property) {
        throw new Error(
          `Schema path segment "${segment}" is not a property of the object (available: ${
            Object.keys(schema.properties ?? {}).join(', ') || 'none'
          })`
        )
      }

      if (property.type === 'custom') {
        throw new Error(`Schema path segment "${segment}" is a custom value and cannot be traversed`)
      }

      return traverseSchema(property, rest)
    }

    case 'array': {
      if (segment !== 'items') {
        throw new Error(
          `Schema path segment "${segment}" cannot traverse an array; use "items" to descend into the element schema`
        )
      }

      return traverseSchema(schema.items, rest)
    }

    case 'union': {
      return traverseSchema(selectUnionMember(schema, segment), rest)
    }

    default: {
      throw new Error(`Schema path segment "${segment}" cannot traverse a "${schema.type}" schema`)
    }
  }
}

/**
 * Pick one member of a union for an {@link SchemaPath} segment. The segment's
 * notation chooses the branching strategy:
 *
 * - `'$Circle'` (`$`-prefixed) → by **member refName** (the schema identity).
 * - `'{type:circle}'` (`{property:value}`) → by **discriminator** — the property
 *   must match the union's `discriminator.propertyName`, and the value is looked
 *   up in `discriminator.mapping` (or used as an implicit schema name).
 * - `'[0]'` (bracketed) → by **member index** — the fallback for inline/anonymous
 *   members that have no refName.
 *
 * A plain (un-prefixed) segment is not a valid union selector.
 *
 * @throws Error when the segment is not a valid selector or selects no member.
 */
const selectUnionMember = (union: OasUnion, segment: string): OasSchema | OasRef<'schema'> => {
  const indexMatch = segment.match(/^\[(\d+)\]$/)
  if (indexMatch) {
    const index = Number(indexMatch[1])
    const member = union.members[index]

    if (!member) {
      throw new Error(
        `Schema path segment "${segment}" is out of range; the union has ${union.members.length} member(s)`
      )
    }

    return member
  }

  const discriminatorMatch = segment.match(/^\{([^:]+):(.+)\}$/)
  if (discriminatorMatch) {
    const [, propertyName, value] = discriminatorMatch

    if (!union.discriminator) {
      throw new Error(
        `Schema path segment "${segment}" needs a discriminated union, but this union has no discriminator`
      )
    }

    if (union.discriminator.propertyName !== propertyName) {
      throw new Error(
        `Schema path segment "${segment}" discriminates on "${propertyName}", but this union's discriminator is "${union.discriminator.propertyName}"`
      )
    }

    const mapped = union.discriminator.mapping?.[value]
    const targetRefName = mapped ? toRefName(mapped) : value
    const member = findMemberByRefName(union, targetRefName)

    if (!member) {
      throw new Error(
        `Schema path segment "${segment}" does not resolve to a union member via the discriminator`
      )
    }

    return member
  }

  if (segment.startsWith('$')) {
    const member = findMemberByRefName(union, segment.slice(1))

    if (!member) {
      const refNames = union.members.filter(member => member.isRef()).map(member => member.toRefName())
      throw new Error(
        `Schema path segment "${segment}" does not match a union member refName (available: ${
          refNames.map(name => `$${name}`).join(', ') || 'none — use "[index]" for inline members'
        })`
      )
    }

    return member
  }

  throw new Error(
    `Schema path segment "${segment}" is not a valid union selector; use "$RefName", "{discriminator:value}", or "[index]"`
  )
}

const findMemberByRefName = (
  union: OasUnion,
  refName: string
): OasSchema | OasRef<'schema'> | undefined =>
  union.members.find(member => member.isRef() && member.toRefName() === refName)
