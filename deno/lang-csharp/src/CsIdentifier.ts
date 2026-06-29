import { IdentifierBase } from '@skmtc/core'
import type { IdentifierBaseArgs, IdentifierType } from '@skmtc/core'
import type { CsEntityType } from './createIdentifier.ts'

/**
 * The non-`name` parts of a C# identifier — core's neutral
 * {@link IdentifierType} with its `type` narrowed to C#'s fixed
 * {@link CsEntityType} vocabulary. This is the named form generators annotate
 * `toIdentifierType` with; a projection-base veneer threads it as the config's
 * `IdType` so the return tightens with no recast. The engine spreads it into
 * `lang.toIdentifier({ name, ...identifierType })`.
 */
export type CsIdentifierType = IdentifierType & { type: CsEntityType }

/**
 * Constructor arguments for {@link CsIdentifier} — the neutral
 * {@link IdentifierBaseArgs} plus this language's typed `type`.
 */
export type CsIdentifierArgs = IdentifierBaseArgs & {
  type: CsEntityType
}

/**
 * C#'s concrete {@link IdentifierBase}: adds the typed `type`
 * ({@link CsEntityType}) the renderer reads to pick its declaration shell
 * (`sealed partial record` / `abstract partial record` / `enum` /
 * `sealed partial class` / `interface`).
 *
 * The engine holds it as the neutral `IdentifierBase` (reading only
 * `.name`); `CsDefinition` narrows back to `CsIdentifier` via
 * {@link isCsIdentifier} to read `type`.
 */
export class CsIdentifier extends IdentifierBase {
  /** Per-language declaration type — drives the declaration shell. */
  type: CsEntityType

  constructor({ name, typeName, exported, type }: CsIdentifierArgs) {
    super({ name, typeName, exported })
    this.type = type
  }
}

/**
 * Type guard narrowing a neutral {@link IdentifierBase} to a
 * {@link CsIdentifier} — the cast-free way the renderer reads `type`.
 */
export const isCsIdentifier = (identifier: IdentifierBase): identifier is CsIdentifier => {
  return identifier instanceof CsIdentifier
}
