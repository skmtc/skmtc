import type { DefinitionBase } from '@/dsl/Definition.ts'
import type { FindDefinitionsQuery } from '@/dsl/CodeFileBase.ts'

/**
 * A place definitions can be inserted into.
 *
 * Files were the only such place until languages with member-holding
 * declarations arrived: a Kotlin `interface` body, a C# `class` body, a Java
 * `enum` body all hold named declarations the same way a file does. This is
 * the pair of operations the engine needs from either, and
 * {@link import('./CodeFileBase.ts').CodeFileBase} already satisfies it — a
 * declaration's VALUE satisfying it too is what makes the declaration an
 * insertion target.
 *
 * What that buys is the property files already have: order independence.
 * Every producer looks a member up before creating it, so members may arrive
 * in any order, and the container is found or created by whoever needs it
 * first — no accumulating `add` method, and no second vocabulary for
 * generators that group their output.
 */
export type DefinitionContainer = {
  /**
   * Add a member, applying the language's duplication rule. Called by the
   * engine's `register` when a `into` target is named.
   */
  addDefinition(definition: DefinitionBase): void
  /**
   * The read seam the cross-generator cache uses, identical to a file's:
   * matching members, or `undefined` when nothing matches.
   */
  findDefinitions(query?: FindDefinitionsQuery): DefinitionBase[] | undefined
}

/**
 * Whether a definition's value can hold members.
 *
 * Structural rather than nominal on purpose: `instanceof` fails across module
 * instances — two copies of a language package in one bundle is a real
 * situation — and the failure is silent, so a value that plainly implements
 * the contract must be accepted however it was constructed.
 */
export const isDefinitionContainer = (value: unknown): value is DefinitionContainer => {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as Partial<DefinitionContainer>

  return (
    typeof candidate.addDefinition === 'function' && typeof candidate.findDefinitions === 'function'
  )
}
