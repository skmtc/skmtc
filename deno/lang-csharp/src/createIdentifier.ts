import { CsIdentifier } from './CsIdentifier.ts'

/**
 * C#'s declaration-kind vocabulary — the typed `kind` this package writes
 * onto its {@link CsIdentifier} and the discriminator its renderers
 * narrow against.
 *
 * - `'record'` — a nominal `sealed partial record Name { … }` DTO with
 *   property members (D3: nominal, not positional; `sealed` by default,
 *   `partial` always — the consumer extension seam).
 * - `'abstract-record'` — an `abstract partial record Name;` polymorphic
 *   parent (CS-B / D14: open by definition — NOT sealed — carrying the
 *   parent-side `[JsonPolymorphic]`/`[JsonDerivedType]` attributes via
 *   the `CsAttributed` protocol).
 * - `'enum'` — an `enum Name { … }` declaration.
 * - `'class'` — a `sealed partial class Name(…) : Base { … }`
 *   declaration (CS-C: the generated-controller idiom; the primary
 *   constructor rides the `CsConstructed` value protocol).
 * - `'interface'` — an `interface IName { … }` declaration (CS-C: the
 *   service seam the consumer implements).
 *
 * Deliberately NO alias kind (C# has no exported type alias — `using X
 * = …` is file-scoped, D6) and NO `val`-analog kind: C#'s distinctive
 * constraint is *types only at namespace scope*. {@link toCsKeyword}
 * throwing on anything else is that constraint's test.
 *
 * Unlike TypeScript, the kind does NOT drive import form — every C#
 * using is namespace-level. It drives only the declaration shell.
 */
export type CsEntityKind = 'record' | 'abstract-record' | 'enum' | 'class' | 'interface'

/**
 * Options shared by the identifier factories — every field optional, so
 * the common case stays `createRecord(name)`.
 */
export type CreateCsIdentifierArgs = {
  /** Whether the identifier is public. Defaults to `true` (renders `public`); `false` renders `internal` — C# types default to internal, so BOTH states render a keyword (the fifth `exported` behavior). */
  exported?: boolean
}

/**
 * Creates a nominal record identifier.
 *
 * @example
 * ```typescript
 * const user = createRecord('User')
 * // CsDefinition renders: public sealed partial record User { … }
 * ```
 */
export const createRecord = (name: string, args: CreateCsIdentifierArgs = {}): CsIdentifier => {
  return new CsIdentifier({ name, exported: args.exported, kind: 'record' })
}

/**
 * Creates a polymorphic-parent record identifier.
 *
 * @example
 * ```typescript
 * const animal = createAbstractRecord('Animal')
 * // CsDefinition renders: public abstract partial record Animal;
 * ```
 */
export const createAbstractRecord = (
  name: string,
  args: CreateCsIdentifierArgs = {}
): CsIdentifier => {
  return new CsIdentifier({ name, exported: args.exported, kind: 'abstract-record' })
}

/**
 * Creates an `enum` identifier.
 *
 * @example
 * ```typescript
 * const status = createEnum('Status')
 * // CsDefinition renders: public enum Status { … }
 * ```
 */
export const createEnum = (name: string, args: CreateCsIdentifierArgs = {}): CsIdentifier => {
  return new CsIdentifier({ name, exported: args.exported, kind: 'enum' })
}

/**
 * Creates a concrete `class` identifier.
 *
 * @example
 * ```typescript
 * const controller = createClass('UsersController')
 * // CsDefinition renders: public sealed partial class UsersController(…) : ControllerBase { … }
 * ```
 */
export const createClass = (name: string, args: CreateCsIdentifierArgs = {}): CsIdentifier => {
  return new CsIdentifier({ name, exported: args.exported, kind: 'class' })
}

/**
 * Creates an `interface` identifier.
 *
 * @example
 * ```typescript
 * const seam = createInterface('IUsersService')
 * // CsDefinition renders: public interface IUsersService { … }
 * ```
 */
export const createInterface = (name: string, args: CreateCsIdentifierArgs = {}): CsIdentifier => {
  return new CsIdentifier({ name, exported: args.exported, kind: 'interface' })
}

/**
 * Maps an identifier's opaque `kind` to its C# declaration keyword
 * chain. The D3 modifiers ride the mapping — `'record'` renders `sealed
 * partial record`, so "sealed by default, partial always" is a property
 * of the kind, not a flag (the CS-B `abstract-record` becomes a distinct
 * kind rendering `abstract partial record`, not a toggle).
 *
 * Throws on a kind outside this language's vocabulary — a loud signal
 * that an identifier built for another language (or with a typo'd kind)
 * reached the C# renderer. This throw is also the
 * types-only-at-namespace-scope distinctive-constraint test: there is no
 * alias kind and no file-scope-value kind to map.
 */
export const toCsKeyword = (kind: string): string => {
  switch (kind) {
    case 'record':
      return 'sealed partial record'
    case 'abstract-record':
      return 'abstract partial record'
    case 'enum':
      return 'enum'
    case 'class':
      return 'sealed partial class'
    case 'interface':
      return 'interface'
    default:
      throw new Error(`Unknown C# entity kind: ${kind}`)
  }
}

/**
 * Narrow the engine's opaque `kind: string` (from `Lang.toIdentifier`'s
 * neutral args) to this language's {@link CsEntityKind} — cast-free, via a
 * validating switch. Throws on a kind outside the vocabulary, the same loud
 * signal {@link toCsKeyword} gives.
 */
export const toCsEntityKind = (kind: string): CsEntityKind => {
  switch (kind) {
    case 'record':
      return 'record'
    case 'abstract-record':
      return 'abstract-record'
    case 'enum':
      return 'enum'
    case 'class':
      return 'class'
    case 'interface':
      return 'interface'
    default:
      throw new Error(`Unknown C# entity kind: ${kind}`)
  }
}
