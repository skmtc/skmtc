import { IdentifierBase } from '@skmtc/core'
import type { IdentifierBaseArgs } from '@skmtc/core'

/**
 * PHP's declaration-type vocabulary — the discriminant {@link PhpDefinition}
 * reads to pick its container keyword (`class` / `interface` / `enum` /
 * `trait`). A second independent consumer of the per-language `type` after
 * Rust.
 */
export type PhpEntityType = 'class' | 'interface' | 'enum' | 'trait'

/**
 * Constructor arguments for {@link PhpIdentifier} — the neutral
 * {@link IdentifierBaseArgs} plus this language's typed `type`.
 */
export type PhpIdentifierArgs = IdentifierBaseArgs & {
  type: PhpEntityType
}

/**
 * PHP's concrete {@link IdentifierBase}: adds the typed `type`
 * ({@link PhpEntityType}) the renderer reads to pick its container keyword
 * (`class` / `interface` / `enum` / `trait`).
 *
 * The engine holds it as the neutral `IdentifierBase` (reading only
 * `.name`); {@link PhpDefinition} narrows back to `PhpIdentifier` via
 * {@link isPhpIdentifier} to read `type`.
 */
export class PhpIdentifier extends IdentifierBase {
  /** Per-language declaration type — drives the container keyword. */
  type: PhpEntityType

  constructor({ name, typeName, exported, type }: PhpIdentifierArgs) {
    super({ name, typeName, exported })
    this.type = type
  }
}

/**
 * Type guard narrowing a neutral {@link IdentifierBase} to a
 * {@link PhpIdentifier} — the cast-free way the renderer reads `type`.
 */
export const isPhpIdentifier = (identifier: IdentifierBase): identifier is PhpIdentifier => {
  return identifier instanceof PhpIdentifier
}
