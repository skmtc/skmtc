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
 * Kotlin's concrete {@link IdentifierBase}: adds the typed `type`
 * ({@link KtEntityType}) the renderer reads to pick its declaration shell
 * (`data class` / `enum class` / `sealed interface` / `typealias` / `val`
 * / …).
 *
 * The engine holds it as the neutral `IdentifierBase` (reading only
 * `.name`); `KtDefinition` narrows back to `KtIdentifier` via
 * {@link isKtIdentifier} to read `type`.
 */
export class KtIdentifier extends IdentifierBase {
  /** Per-language declaration type — drives the declaration shell. */
  type: KtEntityType

  constructor({ name, typeName, exported, type }: KtIdentifierArgs) {
    super({ name, typeName, exported })
    this.type = type
  }
}

/**
 * Type guard narrowing a neutral {@link IdentifierBase} to a
 * {@link KtIdentifier} — the cast-free way the renderer reads `type`.
 */
export const isKtIdentifier = (identifier: IdentifierBase): identifier is KtIdentifier => {
  return identifier instanceof KtIdentifier
}
