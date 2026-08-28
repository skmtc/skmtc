import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContextType } from '@/context/parseTypes.ts'
import type { SchemaExpansion } from '@/context/SchemaExpansion.ts'
import { isRef, toGetRef, toRefName } from '@/helpers/refFns.ts'

/**
 * How the merge layer is about to use a dereferenced schema.
 *
 * - `base`: an `allOf` member being copied into the schema under
 *   construction (`Child: allOf [Parent, …]`).
 * - `member`: a union member a wrapper's keywords are being pushed into,
 *   or one side of a property-level merge.
 */
export type RefRole = 'base' | 'member'

/**
 * Thrown when the merge layer asks to copy a schema whose own `allOf` is
 * being merged right now, as a union MEMBER. The cross product catches it
 * and keeps the member as the reference it already is — the wrapper's
 * keywords are not applied to a schema that is still being built.
 */
export class CyclicMemberError extends Error {
  readonly refName: string

  constructor(refName: string) {
    super(`"${refName}" is being built and cannot be copied into a union member`)
    this.refName = refName
  }
}

/**
 * The `$ref` resolver the merge layer runs with. The call resolves a ref;
 * the two optional members let the merge layer keep the parse's cycle
 * record up to date without knowing what it is (plain document lookups and
 * test doubles leave them undefined).
 */
export type ParseGetRefFn = {
  (ref: OpenAPIV3.ReferenceObject, role?: RefRole): OpenAPIV3.SchemaObject
  /** Run `fn` with these `$ref` names recorded as bases being copied in. */
  withChain?: <T>(names: string[], fn: () => T) => T
  /** Run `fn` as the merge of the `allOf` of the schema named `name`. */
  withEliminating?: <T>(name: string, fn: () => T) => T
  /** The name an inline `allOf` node is being merged under, if it is. */
  chainNameOf?: (node: object) => string | undefined
  /** The component an `allOf` array was resolved from, when it was. */
  ownerOf?: (allOf: object) => string | undefined
}

/**
 * The `$ref` resolver the merge layer uses during a parse. Wraps the plain
 * document lookup with what a cyclic document needs:
 *
 * 1. A schema the parser named itself (a recursive inline `allOf`, see
 *    `SchemaExpansion`) is not in the author's document; it resolves here.
 * 2. **A schema being copied is never copied again.** A `base` whose
 *    `allOf` is already being merged (`A: allOf [B]`, `B: allOf [A]`) has no
 *    finite reading; the throw lands in `tryParseAt` as an `INVALID_SCHEMA`
 *    issue naming the cycle. A `member` in that state throws
 *    {@link CyclicMemberError}, which the cross product answers by keeping
 *    the reference.
 * 3. **A base's union that names a schema being copied is stripped.** In
 *    `Parent: { …, oneOf: [Child] }` with `Child: allOf [Parent, …]`, the
 *    only consistent reading for `Child` is its own branch of that union, so
 *    `Parent` contributes its keywords minus the union — however the idiom
 *    is spelled (bare refs, `{ allOf: [{ $ref }] }` wrappers, an inline
 *    member, an intermediate level in the chain).
 */
export const toParseGetRef = (context: ParseContextType): ParseGetRefFn => {
  const getRef = toGetRef(context.documentObject)
  const expansion = context.expansion

  const resolve: ParseGetRefFn = (ref, role = 'member') => {
    const refName = toRefName(ref.$ref)
    const target = expansion.synthesizedRaw(refName) ?? getRef(ref)

    if (expansion.isEliminating(refName)) {
      if (role === 'base') {
        throw new Error(
          `Cyclic allOf: "${refName}" is being merged and cannot be copied into itself`
        )
      }

      throw new CyclicMemberError(refName)
    }

    if (Array.isArray(target.allOf)) {
      expansion.rememberOwner(target.allOf, refName)
    }

    if (!listsAChainMember(target, refName, expansion, getRef)) {
      return target
    }

    const { oneOf: _oneOf, anyOf: _anyOf, discriminator: _discriminator, ...base } = target

    return base
  }

  resolve.withChain = (names, fn) => expansion.withChain(names, fn)
  resolve.withEliminating = (name, fn) => expansion.withEliminating(name, fn)
  resolve.chainNameOf = node => expansion.chainNameOf(node)
  resolve.ownerOf = allOf => expansion.ownerOf(allOf)

  return resolve
}

/**
 * Is `target`'s union a list of its own subclasses — the parent-lists-its-
 * children idiom? True when a member names a schema whose `allOf` is being
 * merged right now (by component name, or by node identity for an inline
 * member), or a member that extends `target` itself, directly or through an
 * intermediate level. Copying such a parent in as a base must not bring the
 * subclass list: the schema being built IS one of the branches.
 */
const listsAChainMember = (
  target: OpenAPIV3.SchemaObject,
  targetName: string,
  expansion: SchemaExpansion,
  getRef: (ref: OpenAPIV3.ReferenceObject) => OpenAPIV3.SchemaObject
): boolean => {
  const members = [...(target.oneOf ?? []), ...(target.anyOf ?? [])]

  return members.some(member => {
    if (!isRef(member) && expansion.chainNameOf(member) !== undefined) {
      return true
    }

    return memberRefNames(member).some(
      name => expansion.onChain(name) || extendsSchemaTransitively(name, targetName, getRef)
    )
  })
}

/**
 * Does the component `name` reach `ancestor` through `allOf` bases —
 * `Child: allOf [Parent]`, `Parent: allOf [Grandparent]`? Bounded and
 * cycle-safe; an unresolvable ref counts as "no".
 */
export const extendsSchemaTransitively = (
  name: string,
  ancestor: string,
  getRef: (ref: OpenAPIV3.ReferenceObject) => OpenAPIV3.SchemaObject,
  seen: Set<string> = new Set()
): boolean => {
  if (name === ancestor) {
    return true
  }

  if (seen.has(name) || seen.size > 16) {
    return false
  }

  seen.add(name)

  try {
    const schema = getRef({ $ref: `#/components/schemas/${name}` })
    const allOf = Array.isArray(schema.allOf) ? schema.allOf : []

    return allOf
      .filter(isRef)
      .some(base => extendsSchemaTransitively(toRefName(base.$ref), ancestor, getRef, seen))
  } catch {
    return false
  }
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

/**
 * Every `$ref` name a union member names directly: itself, or the members
 * of its own `allOf` (an inline `{ allOf: [{ $ref }, …] }` member).
 */
export const memberRefNames = (
  member: OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject
): string[] => {
  if (isRef(member)) {
    return [toRefName(member.$ref)]
  }

  const allOf = Array.isArray(member.allOf) ? member.allOf : []

  return allOf.filter(isRef).map(item => toRefName(item.$ref))
}

/** Does `schema` have an `allOf` member `$ref`-ing the component `name`? */
export const extendsSchema = (schema: OpenAPIV3.SchemaObject, name: string): boolean => {
  const allOf = schema.allOf

  if (!Array.isArray(allOf)) {
    return false
  }

  return allOf.some(member => isRef(member) && toRefName(member.$ref) === name)
}
