import { isRef } from '@/helpers/refFns.ts'
import type { GetRefFn, ReferenceObject, SchemaOrReference } from './types.ts'

/**
 * Cycle handling for `allOf` / `oneOf` expansion.
 *
 * A schema reachable from itself has no finite expansion. `TargetView` in
 * buddy-api is the worked example: it carries a `oneOf` of 18 variants and each
 * variant is `allOf: [{$ref: TargetView}, …]`, so expanding one variant
 * re-expands all eighteen, each of which re-expands the variant. Base-18
 * growth, unbounded depth — measured at roughly 80x per added variant, which
 * burns the isolate long before it finishes.
 *
 * The answer is the one the single-member `allOf` path already takes (see
 * `parse/v3-0/schema/toSchemasV3.ts`, "eagerly resolving it would not
 * terminate"): leave the reference alone. `toSchemaV3` turns a surviving `$ref`
 * into an `OasRef` that resolves lazily at use time, which is what the emitted
 * types want anyway — a reference, not an infinite inlining.
 *
 * Path-scoped, never global. A schema legitimately referenced twice in sibling
 * positions must expand in both, and a global set would leave the second one a
 * bare ref — changing output for acyclic documents, which is exactly what must
 * not happen.
 */

/** Whether expanding `schema` would re-enter a `$ref` already on this path. */
export const closesCycle = (getRef: GetRefFn, schema: SchemaOrReference): boolean =>
  isRef(schema) && (getRef.expanding?.has(schema.$ref) ?? false)

/** The same resolver, with `$ref` added to the path its descendants see. */
export const enteringRef = (getRef: GetRefFn, { $ref }: ReferenceObject): GetRefFn => {
  const scoped: GetRefFn = ref => getRef(ref)

  return Object.defineProperty(scoped, 'expanding', {
    value: new Set(getRef.expanding ?? []).add($ref),
    enumerable: true
  })
}

/**
 * Resolve `member` for merging, and hand back the resolver its own expansion
 * should use. A member that closes a cycle is returned untouched, so the merge
 * keeps it as a reference instead of inlining it forever.
 */
export const derefMember = (
  member: SchemaOrReference,
  getRef: GetRefFn
): [SchemaOrReference, GetRefFn] => {
  if (!isRef(member) || closesCycle(getRef, member)) {
    return [member, getRef]
  }

  return [getRef(member), enteringRef(getRef, member)]
}
