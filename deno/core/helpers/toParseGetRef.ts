import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContextType } from '@/context/parseTypes.ts'
import { toSchemaExpansion } from '@/context/SchemaExpansion.ts'
import { isRef, toGetRef, toRefName } from '@/helpers/refFns.ts'

/**
 * How the merge layer is about to use a dereferenced schema.
 *
 * - `base`: an `allOf` member being copied into the schema under
 *   construction (`Child: allOf [Parent, …]`).
 * - `member`: a union member a wrapper's keywords are being pushed into,
 *   or one side of a property-level merge.
 *
 * The distinction matters only for cycles, and only `base` gets guarded.
 */
export type RefRole = 'base' | 'member'

export type ParseGetRefFn = (
  ref: OpenAPIV3.ReferenceObject,
  role?: RefRole
) => OpenAPIV3.SchemaObject

/**
 * The `$ref` resolver the merge layer uses during a parse. Wraps the plain
 * document lookup with the two things a cyclic document needs:
 *
 * 1. A schema the parser named itself (a recursive inline `allOf`, see
 *    `SchemaExpansion`) is not in the author's document; it resolves here.
 * 2. Copying a `base` in can loop. Two shapes are cut:
 *    - **Direct re-entry** — the base is a schema whose own `allOf` is
 *      being merged right now (`A: allOf [B]`, `B: allOf [A]`). No finite
 *      reading exists; the throw lands in `tryParseAt` as an
 *      `INVALID_SCHEMA` issue. A base that is merely being BUILT (its union
 *      members are being parsed, and one of them leads back here) is the
 *      ordinary recursion a named component resolves, and is copied.
 *    - **Parent lists its children** — the base carries a `oneOf`/`anyOf`
 *      naming the schema being built, and that schema extends the base
 *      (`Parent: { …, oneOf: [Child] }`, `Child: allOf [Parent, …]`). The
 *      only consistent reading for `Child` is its own branch of that union,
 *      so the base contributes its keywords minus the union.
 *
 * A `member` resolve is never guarded: pushing wrapper keywords into a
 * member copies the member's properties by reference, which is finite; the
 * parse-level recursion that can follow is caught by node identity in
 * `toSchemaV3`.
 */
export const toParseGetRef = (context: ParseContextType): ParseGetRefFn => {
  const getRef = toGetRef(context.documentObject)
  const expansion = toSchemaExpansion(context)

  return (ref, role = 'member') => {
    const refName = toRefName(ref.$ref)
    const target = expansion.synthesizedRaw(refName) ?? getRef(ref)

    if (role !== 'base') {
      return target
    }

    if (expansion.isBuildingName(refName)) {
      throw new Error(`Cyclic allOf: "${refName}" is being merged and cannot be copied into itself`)
    }

    if (!listsAnActiveChild(target, refName, getRef, expansion.isActive.bind(expansion))) {
      return target
    }

    const { oneOf: _oneOf, anyOf: _anyOf, discriminator: _discriminator, ...base } = target

    return base
  }
}

/**
 * Does `target`'s union name a schema that is being built AND that
 * `allOf`-extends `target`? Sees through the `oneOf: [{ allOf: [{ $ref }] }]`
 * spelling some generators emit for the same idiom.
 */
const listsAnActiveChild = (
  target: OpenAPIV3.SchemaObject,
  targetName: string,
  getRef: (ref: OpenAPIV3.ReferenceObject) => OpenAPIV3.SchemaObject,
  isActive: (name: string) => boolean
): boolean => {
  const members = [...(target.oneOf ?? []), ...(target.anyOf ?? [])]

  return members.some(member => {
    const ref = toMemberRef(member)

    if (ref === undefined) {
      return false
    }

    const memberName = toRefName(ref.$ref)

    return isActive(memberName) && extendsSchema(getRef(ref), targetName)
  })
}

/** A union member's `$ref`, unwrapping a single-member `allOf` around it. */
export const toMemberRef = (
  member: OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject
): OpenAPIV3.ReferenceObject | undefined => {
  if (isRef(member)) {
    return member
  }

  const allOf = member.allOf

  if (Array.isArray(allOf) && allOf.length === 1 && isRef(allOf[0])) {
    return allOf[0]
  }

  return undefined
}

/** Does `schema` have an `allOf` member `$ref`-ing the component `name`? */
export const extendsSchema = (schema: OpenAPIV3.SchemaObject, name: string): boolean => {
  const allOf = schema.allOf

  if (!Array.isArray(allOf)) {
    return false
  }

  return allOf.some(member => isRef(member) && toRefName(member.$ref) === name)
}
