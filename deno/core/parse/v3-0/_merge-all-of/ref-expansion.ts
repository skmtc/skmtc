import type { ReferenceObject } from './types.ts'

/**
 * The `$ref`s currently being expanded, innermost last.
 *
 * The `allOf` merge flattens composition by inlining referenced schemas. That
 * only terminates while the reference graph is acyclic, and OpenAPI's standard
 * discriminated-union idiom is not: a base schema `oneOf`-lists its variants
 * and every variant `allOf`-extends the base, so expanding one variant reaches
 * the base, whose `oneOf` reaches every variant, which reach the base again.
 * Unguarded, that branches once per union member at every level and exhausts
 * memory in seconds (issue #111).
 *
 * This is the EXPANSION PATH, not a set of everything ever seen. A schema
 * referenced from two sibling `allOf` branches — a diamond — is not a cycle,
 * and both branches must still expand it. Only a `$ref` that is already an
 * ancestor of itself is cut.
 *
 * A module-level stack is sufficient because merging is synchronous and
 * single-threaded: nothing else can interleave between a push and its pop, and
 * `whileExpanding` pops in a `finally` so a thrown conflict (which the merge
 * uses for control flow — see `mergeCrossProduct`) cannot leave the stack dirty.
 */
const expanding: string[] = []

/** True when `ref` is already being expanded further up the current path. */
export const isExpanding = (ref: ReferenceObject): boolean => expanding.includes(ref.$ref)

/** Run `expand` with `ref` marked as open, popping it again on any exit path. */
export const whileExpanding = <T>(ref: ReferenceObject, expand: () => T): T => {
  expanding.push(ref.$ref)

  try {
    return expand()
  } finally {
    expanding.pop()
  }
}
