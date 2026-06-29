import { IdentifierBase } from '@skmtc/core'
import type { IdentifierBaseArgs } from '@skmtc/core'

/**
 * Rust's declaration-type vocabulary — the discriminant {@link RsDefinition}
 * reads to pick its keyword. All three are *type*-level entities (`struct`,
 * `enum`, and a `type` alias), so the keyword is recoverable only from this
 * per-language `type`, not from a binary variable/type split.
 */
export type RsEntityType = 'struct' | 'enum' | 'type'

/**
 * Constructor arguments for {@link RsIdentifier} — the neutral
 * {@link IdentifierBaseArgs} plus this language's typed `type`.
 */
export type RsIdentifierArgs = IdentifierBaseArgs & {
  type: RsEntityType
}

/**
 * Rust's concrete {@link IdentifierBase}: adds the typed `type`
 * ({@link RsEntityType}) the renderer reads to pick its declaration keyword
 * (`struct` / `enum` / `type`).
 *
 * The engine holds it as the neutral `IdentifierBase` (reading only
 * `.name`); {@link RsDefinition} narrows back to `RsIdentifier` via
 * {@link isRsIdentifier} to read `type`.
 */
export class RsIdentifier extends IdentifierBase {
  /** Per-language declaration type — drives the declaration keyword. */
  type: RsEntityType

  constructor({ name, typeName, exported, type }: RsIdentifierArgs) {
    super({ name, typeName, exported })
    this.type = type
  }
}

/**
 * Type guard narrowing a neutral {@link IdentifierBase} to an
 * {@link RsIdentifier} — the cast-free way the renderer reads `type`.
 */
export const isRsIdentifier = (identifier: IdentifierBase): identifier is RsIdentifier => {
  return identifier instanceof RsIdentifier
}
