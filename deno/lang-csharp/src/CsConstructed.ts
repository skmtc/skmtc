import type { Stringable } from '@skmtc/core'

/**
 * The protocol by which a Definition's VALUE supplies a PRIMARY
 * CONSTRUCTOR (C# 12) to {@link import('./CsDefinition.ts').CsDefinition}'s
 * `class` shell — `public sealed partial class
 * UsersController(IUsersService service) : ControllerBase { … }`, the
 * injected-service idiom (the `KtConstructed` analog).
 *
 * Parameters render INLINE on the shell line (one line, the C# idiom —
 * contrast Kotlin's multi-line constructor list). Grammar only — WHICH
 * parameters (an injected seam, say) is generator policy. Remember the
 * spec-28 gotcha: the Driver wraps the PROJECTION, so the projection
 * must mirror the field as a getter.
 */
export type CsConstructed = {
  constructorParameters: Stringable
}

/**
 * Type guard for the {@link CsConstructed} protocol — narrows without casts.
 */
export const isCsConstructed = (value: unknown): value is CsConstructed => {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  if (!('constructorParameters' in value)) {
    return false
  }

  const { constructorParameters } = value

  return (
    typeof constructorParameters === 'string' ||
    (typeof constructorParameters === 'object' &&
      constructorParameters !== null &&
      typeof constructorParameters.toString === 'function')
  )
}
