import { IdentifierBase } from '@skmtc/core'
import type { IdentifierBaseArgs } from '@skmtc/core'

/**
 * Go's declaration-type vocabulary. Go declares every named type with the
 * uniform `type` keyword, so the vocabulary is a single member — but
 * {@link GoIdentifier} still carries it for symmetry with the other
 * languages (and {@link GoDefinition} reads only the neutral base fields,
 * never `type`).
 */
export type GoEntityType = 'type'

/**
 * Constructor arguments for {@link GoIdentifier} — the neutral
 * {@link IdentifierBaseArgs} plus this language's typed `type`.
 */
export type GoIdentifierArgs = IdentifierBaseArgs & {
  type: GoEntityType
}

/**
 * Go's concrete {@link IdentifierBase}: carries the typed `type`
 * ({@link GoEntityType}) for symmetry with the other language subclasses.
 * {@link GoDefinition} reads only the neutral `.name`/`.exported` fields —
 * Go's uniform `type` keyword needs no discriminant — so `type` is here for
 * shape parity, not for rendering.
 */
export class GoIdentifier extends IdentifierBase {
  /** Per-language declaration type — uniform `type` for Go. */
  type: GoEntityType

  constructor({ name, typeName, exported, type }: GoIdentifierArgs) {
    super({ name, typeName, exported })
    this.type = type
  }
}

/**
 * Type guard narrowing a neutral {@link IdentifierBase} to a
 * {@link GoIdentifier}.
 */
export const isGoIdentifier = (identifier: IdentifierBase): identifier is GoIdentifier => {
  return identifier instanceof GoIdentifier
}
