import { IdentifierBase } from '@skmtc/core'
import type { IdentifierBaseArgs } from '@skmtc/core'

/**
 * Rust's declaration-kind vocabulary — the discriminant {@link RsDefinition}
 * reads to pick its keyword. All three are *type*-level entities (`struct`,
 * `enum`, and a `type` alias), so the keyword is recoverable only from this
 * per-language `kind`, not from a binary variable/type split.
 */
export type RsEntityKind = 'struct' | 'enum' | 'type'

/**
 * Constructor arguments for {@link RsIdentifier} — the neutral
 * {@link IdentifierBaseArgs} plus this language's typed `kind`.
 */
export type RsIdentifierArgs = IdentifierBaseArgs & {
  kind: RsEntityKind
}

/**
 * Rust's concrete {@link IdentifierBase}: adds the typed `kind`
 * ({@link RsEntityKind}) the renderer reads to pick its declaration keyword
 * (`struct` / `enum` / `type`).
 *
 * The engine holds it as the neutral `IdentifierBase` (reading only
 * `.name`); {@link RsDefinition} narrows back to `RsIdentifier` via
 * {@link isRsIdentifier} to read `kind`.
 */
export class RsIdentifier extends IdentifierBase {
  /** Per-language declaration kind — drives the declaration keyword. */
  kind: RsEntityKind

  constructor({ name, typeName, exported, kind }: RsIdentifierArgs) {
    super({ name, typeName, exported })
    this.kind = kind
  }
}

/**
 * Type guard narrowing a neutral {@link IdentifierBase} to an
 * {@link RsIdentifier} — the cast-free way the renderer reads `kind`.
 */
export const isRsIdentifier = (identifier: IdentifierBase): identifier is RsIdentifier => {
  return identifier instanceof RsIdentifier
}
