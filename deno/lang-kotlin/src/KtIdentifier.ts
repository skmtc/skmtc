import { IdentifierBase } from '@skmtc/core'
import type { IdentifierBaseArgs, IdentifierType } from '@skmtc/core'
import type { KtEntityKind } from './createIdentifier.ts'
import type { KtLang } from './ktLang.ts'

/**
 * The non-`name` parts of a Kotlin identifier — the tightened
 * `IdentifierType` a Kotlin projection's `toIdentifierType` returns.
 * Core's `IdentifierType<KtLang>` recovers the `kind` from {@link KtLang}'s
 * identifier ({@link KtEntityKind}); this alias is the named form generators
 * annotate with. The engine spreads it into
 * `lang.toIdentifier({ name, ...identifierType })`.
 */
export type KtIdentifierType = IdentifierType<KtLang>

/**
 * Constructor arguments for {@link KtIdentifier} — the neutral
 * {@link IdentifierBaseArgs} plus this language's typed `kind`.
 */
export type KtIdentifierArgs = IdentifierBaseArgs & {
  kind: KtEntityKind
}

/**
 * Kotlin's concrete {@link IdentifierBase}: adds the typed `kind`
 * ({@link KtEntityKind}) the renderer reads to pick its declaration shell
 * (`data class` / `enum class` / `sealed interface` / `typealias` / `val`
 * / …).
 *
 * The engine holds it as the neutral `IdentifierBase` (reading only
 * `.name`); `KtDefinition` narrows back to `KtIdentifier` via
 * {@link isKtIdentifier} to read `kind`.
 */
export class KtIdentifier extends IdentifierBase {
  /** Per-language declaration kind — drives the declaration shell. */
  kind: KtEntityKind

  constructor({ name, typeName, exported, kind }: KtIdentifierArgs) {
    super({ name, typeName, exported })
    this.kind = kind
  }
}

/**
 * Type guard narrowing a neutral {@link IdentifierBase} to a
 * {@link KtIdentifier} — the cast-free way the renderer reads `kind`.
 */
export const isKtIdentifier = (identifier: IdentifierBase): identifier is KtIdentifier => {
  return identifier instanceof KtIdentifier
}
