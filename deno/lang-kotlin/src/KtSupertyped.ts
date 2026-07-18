import type { Stringable } from '@skmtc/core'
import { isStringable } from './isStringable.ts'

/**
 * The protocol by which a Definition's VALUE supplies a supertype clause
 * to {@link import('./KtDefinition.ts').KtDefinition} — the ` : Animal`
 * after a declaration shell (`data class Dog(\n…\n) : Animal`).
 *
 * `Lang.toDefinition`'s neutral signature has no supertypes slot, so —
 * exactly like class-level annotations ({@link import('./KtAnnotation.ts').KtAnnotated})
 * — the clause rides on the value: a generator's projection sets a
 * `supertypes` field, and `KtDefinition.toShell()` detects it via
 * {@link isKtSupertyped} and renders the clause. Grammar only: the lang
 * renders ` : A, B`; WHICH supertypes (sealed-union membership, say) is
 * generator policy. Entries are {@link Stringable} so identifiers and
 * snippets compose; they render as bare names — same-package references
 * need no import, and cross-package supertypes are the caller's import
 * to register.
 *
 * Rendered on the `data-class` and `class` shells (the sealed-union
 * member and the SDK client/service-impl idioms; enum conformance and
 * sealed-extends-sealed arrive with a milestone that needs them).
 * Scratch-proved cast-free per the note-19 `KtAnnotated` precedent
 * (spec: `notes/lang/22-kotlin-sealed-oneof-architecture.md`).
 */
export type KtSupertyped = {
  supertypes: Stringable[]
}

/**
 * Type guard for the {@link KtSupertyped} protocol — narrows without casts.
 */
export const isKtSupertyped = (value: unknown): value is KtSupertyped => {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  if (!('supertypes' in value)) {
    return false
  }

  return Array.isArray(value.supertypes) && value.supertypes.every(isStringable)
}
