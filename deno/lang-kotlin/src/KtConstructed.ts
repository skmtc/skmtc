import type { Stringable } from '@skmtc/core'
import { isStringable } from './isStringable.ts'

/**
 * The protocol by which a Definition's VALUE supplies a primary
 * constructor to {@link import('./KtDefinition.ts').KtDefinition}'s
 * `class` shell — the `(\n…\n)` after the class name
 * (`class UsersController(\n    private val service: UsersService\n) { … }`).
 *
 * `Lang.toDefinition`'s neutral signature has no constructor slot, so —
 * exactly like {@link import('./KtAnnotation.ts').KtAnnotated} and
 * {@link import('./KtSupertyped.ts').KtSupertyped} — the clause rides on
 * the value: a generator's value object sets a `constructorParameters`
 * field (typically a {@link import('./KtParameterList.ts').KtParameterList}),
 * and `KtDefinition.toShell()` detects it via {@link isKtConstructed}.
 * Grammar only: the lang renders the clause; WHAT is injected is
 * generator policy.
 *
 * Read for the `class` type only in v1 (`data-class` keeps its
 * value-IS-the-parameter-list shape).
 */
export type KtConstructed = {
  constructorParameters: Stringable
  /**
   * Optional modifiers between the class name and the parameter list —
   * constructor annotations and/or a visibility keyword
   * (`@JsonCreator(mode = JsonCreator.Mode.DISABLED) private`). When
   * present, Kotlin REQUIRES the explicit `constructor` keyword; the
   * lang adds it (that's the grammar rule this package owns) —
   * `class Name @Anno private constructor(\n…\n)`. WHAT the modifiers
   * are is generator policy.
   */
  constructorModifiers?: Stringable
}

/**
 * Type guard for the {@link KtConstructed} protocol — narrows without casts.
 */
export const isKtConstructed = (value: unknown): value is KtConstructed => {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  if (!('constructorParameters' in value)) {
    return false
  }

  return isStringable(value.constructorParameters)
}
