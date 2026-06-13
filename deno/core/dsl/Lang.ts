import type { DefinitionBase } from '@/dsl/Definition.ts'
import type { FileBase } from '@/dsl/FileBase.ts'
import type { ImportBase } from '@/dsl/ImportBase.ts'
import type { IdentifierBase } from '@/dsl/IdentifierBase.ts'
import type { GeneratedValue } from '@/dsl/GeneratedValue.ts'
import type { ClientSettings } from '@/types/Settings.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import type { SnippetBase, SnippetBaseArgs } from '@/dsl/SnippetBase.ts'

/**
 * Arguments for {@link Lang.toDefinition} — everything the language needs
 * to wrap a generated `value` in its own `Definition` subclass.
 *
 * `identifier` stays the neutral {@link IdentifierBase}: the engine holds
 * identifiers as the base and passes that to the factory (which narrows via
 * its own `instanceof` guard). Keeping it neutral is also what lets a typed
 * `Lang` (e.g. `KtLang`) satisfy the bare `Lang` constraint — `identifier`
 * is a contravariant parameter, so a narrower type here would break the
 * subtype relation. The typed identifier surfaces only on `toIdentifier`'s
 * RETURN (a covariant position).
 */
export type LangToDefinitionArgs<V extends GeneratedValue = GeneratedValue> = {
  context: GenerateContextType
  identifier: IdentifierBase
  value: V
  noExport?: boolean
  description?: string
}

/**
 * Arguments for {@link Lang.toImport} — the import of one
 * {@link IdentifierBase} from a module, the cross-file import a Driver
 * registers when a generator references a peer's Definition. Neutral for the
 * same contravariance reason as {@link LangToDefinitionArgs}.
 */
export type LangToImportArgs = {
  identifier: IdentifierBase
  module: string
}

/**
 * Arguments for {@link Lang.toIdentifier} — the engine's identifier-assembly
 * seam. `name` comes from the projection's pure `toIdentifierName`; the
 * remaining fields come from the context-aware `toIdentifierType`
 * (spread in). The language builds its concrete `IdentifierBase` subclass
 * (`TsIdentifier` / `KtIdentifier`), reading the opaque `kind` into its
 * typed `EntityKind` slot.
 */
export type LangToIdentifierArgs = {
  name: string
  kind: string
  typeName?: string
  exported?: boolean
}

/**
 * The language-specific surface the engine reaches through.
 *
 * A `Lang` is the object a `@skmtc/lang-*` package exposes, carried as the
 * static `lang` on the package's snippet base ({@link LangSnippetConstructor}).
 * Its only consumers are the Drivers — peers the engine can't name
 * concretely — which read it off the projection class (`projection.lang`)
 * ephemerally at each use site. The engine never names a concrete `File` /
 * `Definition` / `Import` — it only ever calls these neutral factories:
 *
 * - `createFile` — construct this language's file for a path.
 * - `toDefinition` — wrap a generated value in this language's `Definition`.
 * - `toImport` — build the import of a single peer `IdentifierBase` from a
 *   module (the Driver's cross-file import).
 * - `toIdentifier` — assemble this language's `IdentifierBase` subclass from
 *   a `name` (the pure `toIdentifierName`) and the spread `IdentifierType`
 *   (the context-aware `toIdentifierType`). The engine's identifier-assembly
 *   seam — it holds the result as the neutral `IdentifierBase`.
 *
 * There is deliberately no concise-import conversion here: the concise
 * vocabulary is intra-lang-package (each language's register function
 * converts its own form), so the neutral interface never names one.
 */
export type Lang<IdentifierT extends IdentifierBase = IdentifierBase> = {
  /** Construct the language's file for `path`. */
  createFile: (args: { path: string; settings: ClientSettings | undefined }) => FileBase
  /** Wrap a generated `value` in this language's `Definition` subclass. */
  toDefinition: <V extends GeneratedValue>(args: LangToDefinitionArgs<V>) => DefinitionBase<V>
  /** Build the import of one peer `IdentifierBase` from a module. */
  toImport: (args: LangToImportArgs) => ImportBase
  /**
   * Assemble this language's `IdentifierBase` subclass from name +
   * kind/type/exported. `kind` arrives as the opaque-boundary `string` (the
   * engine never narrows it); the language reads it into its typed
   * `EntityKind` slot. The returned `IdentifierT` is the language's concrete
   * subclass — its typed `kind` is the ONLY place `IdentifierT` appears (a
   * covariant return position), which is what lets {@link IdentifierType}
   * recover the vocabulary to tighten the projection config while a typed
   * `Lang` still satisfies the bare `Lang` constraint.
   */
  toIdentifier: (args: LangToIdentifierArgs) => IdentifierT
}

/**
 * The language's declaration-kind vocabulary, recovered from the typed
 * `kind` on the {@link IdentifierBase} subclass a `Lang` produces.
 *
 * `KtIdentifier` carries `kind: KtEntityKind`, `TsIdentifier` carries
 * `kind: TsEntityKind`, … The neutral `IdentifierBase` has no `kind`, so a
 * bare `Lang` falls back to the loose `string` — the opaque-kind boundary
 * the engine speaks.
 */
export type LangKind<L extends Lang> = ReturnType<L['toIdentifier']> extends {
  kind: infer Kind extends string
}
  ? Kind
  : string

/**
 * The constructor contract a language's snippet base class must satisfy to
 * be used as the `base` of a projection-base factory
 * (`toModelProjectionBase({ base: TsSnippet, … })`). It is where language
 * enters the DSL class hierarchy; `SnippetBase` itself stays language-blind.
 *
 * `lang` is **static-only**: its reader is the Drivers, which need the
 * peer's language *before* constructing the value (cache-hit path) and read
 * it ephemerally at each use site (`projection.lang`). Statics inherit
 * through class expressions, so every projection class built on the base
 * exposes it with no re-declaration. There is no instance slot — the
 * register paths delegate to the language package's register function,
 * which names its own classes directly.
 *
 * The INSTANCE type stays the concrete {@link SnippetBase}: a core factory
 * generic over the base's *instance* type cannot type-safely extend it
 * (TS2415/TS2545 — see the scratch in `notes/lang/14`), and the price would
 * be that language-specific instance members are type-erased on projection
 * classes. Only the STATIC `lang` is parameterized — over the neutral `Lang`
 * by default, narrowed to a language's typed `Lang` (e.g. `KtLang`) when a
 * veneer threads `L` through. Narrowing a covariant static intersection does
 * not reawaken TS2415; the `extends config.base` in the factories stays well
 * typed because the instance side is unchanged.
 */
export type LangSnippetConstructor<L extends Lang = Lang> = (new (
  args: SnippetBaseArgs
) => SnippetBase) & { lang: L }
