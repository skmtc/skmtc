import { IdentifierBase } from '@skmtc/core'
import type { IdentifierBaseArgs, IdentifierType } from '@skmtc/core'
import type { KtEntityType } from './createIdentifier.ts'

/**
 * The non-`name` parts of a Kotlin identifier — the tightened
 * `IdentifierType` a Kotlin projection's `toIdentifierType` returns.
 * Core's neutral {@link IdentifierType} carries an opaque `type: string`;
 * this alias narrows it to {@link KtEntityType}, the named form generators
 * annotate with. The engine spreads it into
 * `lang.toIdentifier({ name, ...identifierType })`.
 */
export type KtIdentifierType = IdentifierType & { type: KtEntityType }

/**
 * Constructor arguments for {@link KtIdentifier} — the neutral
 * {@link IdentifierBaseArgs} plus this language's typed `type`.
 */
export type KtIdentifierArgs = IdentifierBaseArgs & {
  type: KtEntityType
}

/**
 * Single source of truth for the declaration keywords — each shell-bearing
 * {@link KtEntityType} mapped to the keyword(s) its declaration head
 * renders with. `verbatim` is deliberately absent: it has no declaration
 * head (the value renders as-is; its identifier is cache identity only),
 * so {@link KtIdentifier.toString} falls back to the neutral bare-name
 * render for it.
 */
const ktDeclarationKeywords = {
  'class': 'class',
  'data-class': 'data class',
  'enum-class': 'enum class',
  'interface': 'interface',
  'sealed-interface': 'sealed interface',
  'typealias': 'typealias',
  'val': 'val'
} as const satisfies Record<Exclude<KtEntityType, 'verbatim'>, string>

/**
 * Kotlin's concrete {@link IdentifierBase}: adds the typed `type`
 * ({@link KtEntityType}) and owns the rendering of its own **declaration
 * head** — `data class User`, `enum class Status`, `val timeout: Long` —
 * via {@link toString}. {@link import('./KtDefinition.ts').KtDefinition}
 * interpolates the head and adds only the kind's *arrangement* (parameter
 * parens, supertype clause, braced body); the keyword itself lives here,
 * next to the identifier that determines it.
 *
 * The engine holds it as the neutral `IdentifierBase` (reading only
 * `.name`); `KtDefinition` narrows back to `KtIdentifier` via
 * {@link isKtIdentifier} to read `type`.
 */
export class KtIdentifier extends IdentifierBase {
  /** Per-language declaration type — drives the declaration head and shell. */
  type: KtEntityType

  constructor({ name, typeName, exported, type }: KtIdentifierArgs) {
    super({ name, typeName, exported })
    this.type = type
  }

  /**
   * The declaration head: `<keyword> <name>[: <typeName>]`. Overrides the
   * neutral base's bare-name render — in Kotlin the keyword belongs to the
   * identifier's kind, so the identifier renders it. `verbatim` (no head)
   * keeps the neutral bare-name behavior. Generators splicing a name into
   * generated code should keep using `.name` / `Inserted.toName()`, which
   * this override does not touch.
   */
  override toString(): string {
    if (this.type === 'verbatim') {
      return this.name
    }

    const typeName = this.typeName ? `: ${this.typeName}` : ''

    return `${ktDeclarationKeywords[this.type]} ${this.name}${typeName}`
  }
}

/**
 * Type guard narrowing a neutral {@link IdentifierBase} to a
 * {@link KtIdentifier} — the cast-free way the renderer reads `type`.
 */
export const isKtIdentifier = (identifier: IdentifierBase): identifier is KtIdentifier => {
  return identifier instanceof KtIdentifier
}
