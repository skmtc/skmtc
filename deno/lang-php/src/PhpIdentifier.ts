import { IdentifierBase } from '@skmtc/core'
import type { IdentifierBaseArgs } from '@skmtc/core'

/**
 * PHP's declaration-kind vocabulary — the discriminant {@link PhpDefinition}
 * reads to pick its container keyword (`class` / `interface` / `enum` /
 * `trait`). A second independent consumer of the per-language `kind` after
 * Rust.
 */
export type PhpEntityKind = 'class' | 'interface' | 'enum' | 'trait'

/**
 * Constructor arguments for {@link PhpIdentifier} — the neutral
 * {@link IdentifierBaseArgs} plus this language's typed `kind`.
 */
export type PhpIdentifierArgs = IdentifierBaseArgs & {
  kind: PhpEntityKind
}

/**
 * PHP's concrete {@link IdentifierBase}: adds the typed `kind`
 * ({@link PhpEntityKind}) the renderer reads to pick its container keyword
 * (`class` / `interface` / `enum` / `trait`).
 *
 * The engine holds it as the neutral `IdentifierBase` (reading only
 * `.name`); {@link PhpDefinition} narrows back to `PhpIdentifier` via
 * {@link isPhpIdentifier} to read `kind`.
 */
export class PhpIdentifier extends IdentifierBase {
  /** Per-language declaration kind — drives the container keyword. */
  kind: PhpEntityKind

  constructor({ name, typeName, exported, kind }: PhpIdentifierArgs) {
    super({ name, typeName, exported })
    this.kind = kind
  }
}

/**
 * Type guard narrowing a neutral {@link IdentifierBase} to a
 * {@link PhpIdentifier} — the cast-free way the renderer reads `kind`.
 */
export const isPhpIdentifier = (identifier: IdentifierBase): identifier is PhpIdentifier => {
  return identifier instanceof PhpIdentifier
}
