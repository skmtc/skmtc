import { IdentifierBase } from '@skmtc/core'
import type { IdentifierBaseArgs, IdentifierType } from '@skmtc/core'
import type { TsEntityKind } from './createIdentifier.ts'
import type { TsLang } from './tsLang.ts'

/**
 * The non-`name` parts of a TypeScript identifier — the tightened
 * `IdentifierType` a TS projection's `toIdentifierType` returns. Core's
 * `IdentifierType<TsLang>` recovers the `kind` from {@link TsLang}'s
 * identifier ({@link TsEntityKind}); this alias is the named form generators
 * annotate with. The engine spreads it into
 * `lang.toIdentifier({ name, ...identifierType })`.
 */
export type TsIdentifierType = IdentifierType<TsLang>

/**
 * Constructor arguments for {@link TsIdentifier} — the neutral
 * {@link IdentifierBaseArgs} plus this language's typed `kind`.
 */
export type TsIdentifierArgs = IdentifierBaseArgs & {
  kind: TsEntityKind
}

/**
 * TypeScript's concrete {@link IdentifierBase}: adds the typed `kind`
 * ({@link TsEntityKind}) the renderer reads to pick its declaration keyword
 * (`const` / `type`) and its import form (plain / type-only).
 *
 * The engine holds it as the neutral `IdentifierBase` (reading only
 * `.name`); `TsDefinition` / `TsImport` narrow back to `TsIdentifier` via
 * {@link isTsIdentifier} to read `kind`.
 */
export class TsIdentifier extends IdentifierBase {
  /** Per-language declaration kind — `const` / `type` and import form. */
  kind: TsEntityKind

  constructor({ name, typeName, exported, kind }: TsIdentifierArgs) {
    super({ name, typeName, exported })
    this.kind = kind
  }
}

/**
 * Type guard narrowing a neutral {@link IdentifierBase} to a
 * {@link TsIdentifier} — the cast-free way the renderers read `kind`.
 */
export const isTsIdentifier = (identifier: IdentifierBase): identifier is TsIdentifier => {
  return identifier instanceof TsIdentifier
}
