import { IdentifierBase } from '@skmtc/core'
import type { IdentifierBaseArgs } from '@skmtc/core'

/**
 * Go's declaration-kind vocabulary. Go declares every named type with the
 * uniform `type` keyword, so the vocabulary is a single member — but
 * {@link GoIdentifier} still carries it for symmetry with the other
 * languages (and {@link GoDefinition} reads only the neutral base fields,
 * never `kind`).
 */
export type GoEntityKind = 'type'

/**
 * Constructor arguments for {@link GoIdentifier} — the neutral
 * {@link IdentifierBaseArgs} plus this language's typed `kind`.
 */
export type GoIdentifierArgs = IdentifierBaseArgs & {
  kind: GoEntityKind
}

/**
 * Go's concrete {@link IdentifierBase}: carries the typed `kind`
 * ({@link GoEntityKind}) for symmetry with the other language subclasses.
 * {@link GoDefinition} reads only the neutral `.name`/`.exported` fields —
 * Go's uniform `type` keyword needs no discriminant — so `kind` is here for
 * shape parity, not for rendering.
 */
export class GoIdentifier extends IdentifierBase {
  /** Per-language declaration kind — uniform `type` for Go. */
  kind: GoEntityKind

  constructor({ name, typeName, exported, kind }: GoIdentifierArgs) {
    super({ name, typeName, exported })
    this.kind = kind
  }
}

/**
 * Type guard narrowing a neutral {@link IdentifierBase} to a
 * {@link GoIdentifier}.
 */
export const isGoIdentifier = (identifier: IdentifierBase): identifier is GoIdentifier => {
  return identifier instanceof GoIdentifier
}
