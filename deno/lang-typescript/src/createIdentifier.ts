import { TsIdentifier } from './TsIdentifier.ts'

/**
 * TypeScript's declaration-kind vocabulary — the typed `kind` this package
 * writes onto its {@link TsIdentifier} and the discriminator its renderers
 * narrow against.
 *
 * **Assignment-form** kinds render `export <kw> Name = value;`:
 * - `'variable'` — value entities: `const` declarations and plain
 *   (`import { Foo }`) imports.
 * - `'type'` — type-level entities: `type` declarations and type-only
 *   (`import { type Foo }` / `import type { Foo }`) imports.
 *
 * **Block-form** kinds render `export <kw> Name <value>` — the value carries
 * any heritage and the braced body, with no `= …` and no trailing `;` (see
 * {@link isBlockKind}):
 * - `'class'` — value entity declared with `class`; plain import.
 * - `'interface'` — type-level entity declared with `interface`; type-only
 *   import (like `'type'`).
 * - `'namespace'` — declared with `declare namespace`; plain import (for
 *   `Name.Member` access). The same-file type re-export block the
 *   Stainless-style SDK layout emits.
 *
 * (Formerly core's `EntityTypeValue` — moved here under F5/F6: each
 * language package owns its kind vocabulary; core's `IdentifierBase` no
 * longer carries a `kind` at all.)
 */
export type TsEntityKind = 'variable' | 'type' | 'class' | 'interface' | 'namespace'

/**
 * Options for {@link createVariable} — every field optional, so the
 * common case stays `createVariable(name)`.
 */
export type CreateVariableArgs = {
  /** Optional type annotation for typed variables. */
  typeName?: string
  /** Whether the identifier is exported. Defaults to `true`. */
  exported?: boolean
}

/**
 * Options for {@link createType} — every field optional, so the common
 * case stays `createType(name)`.
 */
export type CreateTypeArgs = {
  /** Whether the identifier is exported. Defaults to `true`. */
  exported?: boolean
}

/**
 * Creates a variable identifier — a value entity that declares with
 * `const` and imports as a plain named import.
 *
 * @example Untyped variable
 * ```typescript
 * const count = createVariable('count');
 * console.log(count.name); // 'count'
 * console.log(count.kind); // 'variable'
 * ```
 *
 * @example Typed variable
 * ```typescript
 * const userId = createVariable('userId', { typeName: 'string' });
 * // TsDefinition renders: export const userId: string = …;
 * ```
 */
export const createVariable = (name: string, args: CreateVariableArgs = {}): TsIdentifier => {
  const { typeName, exported } = args

  return new TsIdentifier({ name, typeName, exported, kind: 'variable' })
}

/**
 * Creates a type identifier — a type-level entity that declares with
 * `type` and imports type-only (`import { type Foo }`).
 *
 * @example
 * ```typescript
 * const userType = createType('User');
 * // TsDefinition renders: export type User = …;
 * ```
 */
export const createType = (name: string, args: CreateTypeArgs = {}): TsIdentifier => {
  const { exported } = args

  return new TsIdentifier({ name, exported, kind: 'type' })
}

/**
 * Options for {@link createClass} / {@link createInterface} /
 * {@link createNamespace} — every field optional, so the common case stays
 * `createClass(name)`.
 */
export type CreateDeclarationArgs = {
  /** Whether the identifier is exported. Defaults to `true`. */
  exported?: boolean
}

/**
 * Creates a class identifier — a value entity that declares with `class` in
 * block form (`export class Name <heritage+body>`) and imports as a plain
 * named import. The projection's value carries any `extends` / `implements`
 * heritage and the braced body.
 *
 * @example
 * ```typescript
 * const models = createClass('Models');
 * // TsDefinition renders: export class Models <value>
 * ```
 */
export const createClass = (name: string, args: CreateDeclarationArgs = {}): TsIdentifier => {
  const { exported } = args

  return new TsIdentifier({ name, exported, kind: 'class' })
}

/**
 * Creates an interface identifier — a type-level entity that declares with
 * `interface` in block form (`export interface Name <heritage+body>`) and
 * imports type-only (`import { type Foo }`), like {@link createType}.
 *
 * @example
 * ```typescript
 * const model = createInterface('Model');
 * // TsDefinition renders: export interface Model <value>
 * ```
 */
export const createInterface = (name: string, args: CreateDeclarationArgs = {}): TsIdentifier => {
  const { exported } = args

  return new TsIdentifier({ name, exported, kind: 'interface' })
}

/**
 * Creates a namespace identifier — declares with `declare namespace` in
 * block form (`export declare namespace Name <body>`) and imports as a plain
 * named import (for `Name.Member` access). Used for the same-file type
 * re-export blocks the Stainless-style SDK layout emits.
 *
 * @example
 * ```typescript
 * const models = createNamespace('Models');
 * // TsDefinition renders: export declare namespace Models <value>
 * ```
 */
export const createNamespace = (name: string, args: CreateDeclarationArgs = {}): TsIdentifier => {
  const { exported } = args

  return new TsIdentifier({ name, exported, kind: 'namespace' })
}

/**
 * Single source of truth for the TypeScript declaration vocabulary — each
 * {@link TsEntityKind} mapped to the keyword it renders with. `satisfies`
 * makes coverage exhaustive at compile time: a kind added to
 * {@link TsEntityKind} without a keyword here is a type error, not a
 * runtime surprise.
 */
const tsDeclarationKeywords = {
  variable: 'const',
  type: 'type',
  class: 'class',
  interface: 'interface',
  namespace: 'declare namespace'
} as const satisfies Record<TsEntityKind, string>

/**
 * Type guard — whether an opaque `kind` string is one this language knows.
 */
export const isTsEntityKind = (kind: string): kind is TsEntityKind =>
  Object.hasOwn(tsDeclarationKeywords, kind)

/**
 * Narrow the engine's opaque `kind: string` (from `Lang.toIdentifier`'s
 * neutral args) to this language's {@link TsEntityKind} — cast-free, via
 * {@link isTsEntityKind}. Throws on a kind outside the vocabulary, a loud
 * signal that an identifier built for another language (or with a typo'd
 * kind) reached the TypeScript renderer.
 */
export const toTsEntityKind = (kind: string): TsEntityKind => {
  if (!isTsEntityKind(kind)) {
    throw new Error(`Unknown TypeScript entity kind: ${kind}`)
  }

  return kind
}

/**
 * Maps an identifier's opaque `kind` to its TypeScript declaration keyword
 * (`'variable'` → `const`, `'namespace'` → `declare namespace`, …) via the
 * single {@link tsDeclarationKeywords} map. Throws (through
 * {@link toTsEntityKind}) on a kind outside this language's vocabulary.
 */
export const toTsKeyword = (kind: string): string => tsDeclarationKeywords[toTsEntityKind(kind)]

/**
 * Whether a kind renders in *block* form — `export <kw> Name <value>`, where
 * the value carries any heritage and the braced body, with no `= …` and no
 * trailing `;`. `class` / `interface` / `namespace` are block-form;
 * `variable` / `type` are assignment-form (`export <kw> Name = value;`).
 */
export const isBlockKind = (kind: TsEntityKind): boolean =>
  kind === 'class' || kind === 'interface' || kind === 'namespace'

/**
 * Whether a kind imports type-only under `verbatimModuleSyntax` — the
 * type-level kinds `type` and `interface`. (`class` is a value; `namespace`
 * imports as a value for its `.Member` access.)
 */
export const isTypeOnlyKind = (kind: TsEntityKind): boolean =>
  kind === 'type' || kind === 'interface'
