import type { OpenAPIV3 } from 'openapi-types'

/**
 * 3.1 allows `type` to be a LIST — `type: ['string', 'null']` is how 3.1 spells
 * a nullable string, where 3.0 uses `nullable: true` alongside a single type.
 * This is why the check differs from its v3-0 counterpart, which compares two
 * strings and is right to.
 *
 * Comparing lists with `!==` compares references, so two identical lists were
 * always unequal and every such merge was refused. The message gave it away:
 * "conflicting types 'string,null' and 'string,null'" — the two arrays
 * stringified to exactly the same text. `openrouter-api` (3.1.0) lost five
 * schemas to it.
 *
 * Order and repeats carry no meaning — `['string','null']` and
 * `['null','string']` are the same set — so the comparison is set-based.
 */
const toTypeSet = (type: string | string[]): Set<string> =>
  new Set(Array.isArray(type) ? type : [type])

/** Single types keep their existing `'string'` rendering; lists render as lists. */
const describeType = (type: string | string[]): string =>
  Array.isArray(type) ? JSON.stringify(type) : `'${type}'`

const isSameTypeSet = (first: Set<string>, second: Set<string>): boolean =>
  first.size === second.size && [...first].every(type => second.has(type))

export const checkTypeConflicts = (
  first: OpenAPIV3.SchemaObject,
  second: OpenAPIV3.SchemaObject
): void => {
  if (!first.type || !second.type) {
    return
  }

  // Deliberately narrow: only IDENTICAL type sets pass. Overlapping-but-unequal
  // sets (`['string','null']` merged with `['string']`) are satisfiable — the
  // answer is their intersection — but nothing here writes a merged type, and
  // letting them through would leave whichever side the later spread wins with,
  // which is too wide. Computing the intersection belongs with the type merge,
  // not with a check that returns void.
  if (!isSameTypeSet(toTypeSet(first.type), toTypeSet(second.type))) {
    throw new Error(
      `Cannot merge schemas: conflicting types ${describeType(first.type)} and ${describeType(
        second.type
      )}, ${JSON.stringify(first)} and ${JSON.stringify(second)}`
    )
  }
}
