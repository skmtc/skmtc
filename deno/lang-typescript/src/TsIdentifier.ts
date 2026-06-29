import { IdentifierBase } from '@skmtc/core'
import type { IdentifierBaseArgs, IdentifierType } from '@skmtc/core'
import { toTsKeyword, type TsEntityType } from './createIdentifier.ts'

/**
 * The non-`name` parts of a TypeScript identifier — core's neutral
 * {@link IdentifierType} with its `type` narrowed to TypeScript's fixed
 * {@link TsEntityType} vocabulary. This is the named form generators annotate
 * `toIdentifierType` with; a projection-base veneer threads it as the config's
 * `IdType` so the return tightens with no recast. The engine spreads it into
 * `lang.toIdentifier({ name, ...identifierType })`.
 */
export type TsIdentifierType = IdentifierType & { type: TsEntityType }

/**
 * Constructor arguments for {@link TsIdentifier} — the neutral
 * {@link IdentifierBaseArgs} plus this language's typed `type`.
 */
export type TsIdentifierArgs = IdentifierBaseArgs & {
  type: TsEntityType
}

/**
 * TypeScript's concrete {@link IdentifierBase}: adds the typed `type`
 * ({@link TsEntityType}) the renderer reads to pick its declaration keyword
 * (`const` / `type`) and its import form (plain / type-only).
 */
export class TsIdentifier extends IdentifierBase {
  /** Per-language declaration type — `const` / `type` and import form. */
  type: TsEntityType

  constructor({ name, typeName, exported, type }: TsIdentifierArgs) {
    super({ name, typeName, exported })
    this.type = type
  }

  /**
   * TypeScript's declaration slot is the declaration header `<keyword> <name>`
   * (`const thing`, `class Thing`, `declare namespace Thing`) — exactly how
   * the declaration opens. A `class Foo` and a `declare namespace Foo` are
   * separate declarations the compiler merges, so the differing keyword keeps
   * their keys distinct while exact repeats still collapse.
   */
  override declarationKey(): string {
    return `${toTsKeyword(this.type)} ${this.name}`
  }
}
