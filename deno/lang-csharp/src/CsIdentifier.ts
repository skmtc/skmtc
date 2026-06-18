import { IdentifierBase } from '@skmtc/core'
import type { IdentifierBaseArgs, IdentifierType } from '@skmtc/core'
import type { CsEntityKind } from './createIdentifier.ts'
import type { CsLang } from './csLang.ts'

/**
 * The non-`name` parts of a C# identifier — the tightened
 * `IdentifierType` a C# projection's `toIdentifierType` returns. Core's
 * `IdentifierType<CsLang>` recovers the `kind` from {@link CsLang}'s
 * identifier ({@link CsEntityKind}); this alias is the named form generators
 * annotate with. The engine spreads it into
 * `lang.toIdentifier({ name, ...identifierType })`.
 */
export type CsIdentifierType = IdentifierType<CsLang>

/**
 * Constructor arguments for {@link CsIdentifier} — the neutral
 * {@link IdentifierBaseArgs} plus this language's typed `kind`.
 */
export type CsIdentifierArgs = IdentifierBaseArgs & {
  kind: CsEntityKind
}

/**
 * C#'s concrete {@link IdentifierBase}: adds the typed `kind`
 * ({@link CsEntityKind}) the renderer reads to pick its declaration shell
 * (`sealed partial record` / `abstract partial record` / `enum` /
 * `sealed partial class` / `interface`).
 *
 * The engine holds it as the neutral `IdentifierBase` (reading only
 * `.name`); `CsDefinition` narrows back to `CsIdentifier` via
 * {@link isCsIdentifier} to read `kind`.
 */
export class CsIdentifier extends IdentifierBase {
  /** Per-language declaration kind — drives the declaration shell. */
  kind: CsEntityKind

  constructor({ name, typeName, exported, kind }: CsIdentifierArgs) {
    super({ name, typeName, exported })
    this.kind = kind
  }
}

/**
 * Type guard narrowing a neutral {@link IdentifierBase} to a
 * {@link CsIdentifier} — the cast-free way the renderer reads `kind`.
 */
export const isCsIdentifier = (identifier: IdentifierBase): identifier is CsIdentifier => {
  return identifier instanceof CsIdentifier
}
