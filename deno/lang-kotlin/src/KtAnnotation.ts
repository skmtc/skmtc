import type { Stringable } from '@skmtc/core'

/**
 * Renders a Kotlin annotation: `@Serializable`, `@SerialName("user_id")`.
 *
 * Generic grammar only — args are {@link Stringable} and pre-quoted by the
 * caller. WHICH annotation to emit is generator policy (the serialization
 * seam lives in `gen-kotlin`); this package only renders what it is handed.
 */
export class KtAnnotation {
  name: string
  args: Stringable[]

  constructor(name: string, args: Stringable[] = []) {
    this.name = name
    this.args = args
  }

  toString(): string {
    return this.args.length ? `@${this.name}(${this.args.join(', ')})` : `@${this.name}`
  }
}

/**
 * The protocol by which a Definition's VALUE supplies class-level
 * annotations to {@link import('./KtDefinition.ts').KtDefinition}.
 *
 * `Lang.toDefinition`'s neutral signature has no annotations slot, so
 * annotations ride on the value: a generator's projection sets an
 * `annotations` field, and `KtDefinition.toString()` detects it via
 * {@link isKtAnnotated} and renders the annotations above the declaration
 * shell. Scratch-proved per note 19 (cast-free `in` narrowing).
 */
export type KtAnnotated = {
  annotations: KtAnnotation[]
}

/**
 * Type guard for the {@link KtAnnotated} protocol — narrows without casts.
 */
export const isKtAnnotated = (value: unknown): value is KtAnnotated => {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  if (!('annotations' in value)) {
    return false
  }

  return (
    Array.isArray(value.annotations) &&
    value.annotations.every(item => item instanceof KtAnnotation)
  )
}
