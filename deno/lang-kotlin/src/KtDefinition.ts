import { DefinitionBase } from '@skmtc/core'
import type { GeneratedValue, GenerateContextType } from '@skmtc/core'
import { isKtAnnotated } from './KtAnnotation.ts'
import { isKtDocumented } from './KtDocumented.ts'
import type { KtIdentifier } from './KtIdentifier.ts'
import { withDescription } from './withDescription.ts'

/**
 * Constructor arguments for {@link KtDefinition}.
 */
export type KtDefinitionArgs<Value extends GeneratedValue> = {
  context: GenerateContextType
  identifier: KtIdentifier
  value: Value
  description?: string
}

/**
 * Kotlin's concrete {@link DefinitionBase}: renders the identifier's
 * declaration head and the value, each rendering itself.
 *
 * - **Assignment kinds** (`typealias`, `val`) — `${head} = ${value}`;
 *   the value is the right-hand-side expression.
 * - **Declaration kinds** (`class`, `data-class`, `enum-class`,
 *   `interface`, `sealed-interface`) — `${head}${value}`; the value
 *   renders everything after the head: a
 *   {@link import('./KtParameterList.ts').KtParameterList} (parentheses
 *   included), a
 *   {@link import('./KtPrimaryConstructor.ts').KtPrimaryConstructor}
 *   (modifiers + the explicit `constructor` keyword), plus inline
 *   ` : A, B` supertype clauses and ` {\n…\n}` braced bodies — plain
 *   Kotlin syntax carries no grammar rule worth a class. A value that
 *   renders nothing yields the bodyless idiom (`sealed interface
 *   Animal`, `class Marker`) — the value decides its own form; the
 *   definition never inspects it.
 * - **`verbatim`** — the value IS the declaration text; no head, no
 *   visibility, no annotations.
 *
 * Two protocols remain on the value because they render OUTSIDE the
 * head+value line: class-level annotations
 * ({@link import('./KtAnnotation.ts').KtAnnotated}, one per line above
 * the declaration — the neutral `Lang.toDefinition` signature has no
 * annotations slot) and KDoc
 * ({@link import('./KtDocumented.ts').KtDocumented}, above the
 * annotations; an explicit constructor `description` wins).
 *
 * (A foreign identifier is refused earlier, at the `Lang.toDefinition`
 * boundary in `KtLang`; the constructor only accepts a
 * {@link KtIdentifier}.)
 *
 * Visibility is the identifier's fact, rendered in its head (`private
 * data class …` — see {@link KtIdentifier.toString}). The neutral
 * `noExport` flag the Drivers pass is folded into a restricted identifier
 * copy at the `KtLang.toDefinition` boundary, so this class never sees
 * it.
 */
export class KtDefinition<
  Value extends GeneratedValue = GeneratedValue
> extends DefinitionBase<Value> {
  /** Narrows the inherited neutral `identifier` to the concrete Kotlin
   *  subclass (the constructor only accepts a {@link KtIdentifier}). */
  declare identifier: KtIdentifier

  description: string | undefined

  constructor({ context, identifier, value, description }: KtDefinitionArgs<Value>) {
    super({ context, identifier, value })

    this.description = description
  }

  override toString(): string {
    if (this.identifier.type === 'verbatim') {
      // The value IS the declaration text (template files, multi-
      // declaration bodies) — no head, no visibility, no annotations.
      return `${this.value}`
    }

    const annotations = isKtAnnotated(this.value)
      ? this.value.annotations.map(annotation => `${annotation}\n`).join('')
      : ''

    const declaration = `${annotations}${this.toShell()}`

    // Constructor description wins; else the value-carried protocol.
    const description =
      this.description ?? (isKtDocumented(this.value) ? this.value.description : undefined)

    return withDescription(declaration, { description })
  }

  private toShell(): string {
    switch (this.identifier.type) {
      case 'typealias':
      case 'val':
        // Assignment kinds: the value is the right-hand side.
        return `${this.identifier} = ${this.value}`
      default:
        // Declaration kinds: the identifier renders its head, the value
        // renders everything after it (constructor, supertypes, body).
        return `${this.identifier}${this.value}`
    }
  }
}
