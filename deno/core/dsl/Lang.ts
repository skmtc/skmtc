import type { DefinitionBase } from '@/dsl/Definition.ts'
import type { FileBase } from '@/dsl/FileBase.ts'
import type { ImportBase } from '@/dsl/ImportBase.ts'
import type { Identifier } from '@/dsl/Identifier.ts'
import type { GeneratedValue } from '@/dsl/GeneratedValue.ts'
import type { ClientSettings } from '@/types/Settings.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import type { SnippetBase, SnippetBaseArgs } from '@/dsl/SnippetBase.ts'

/**
 * Arguments for {@link Lang.toDefinition} — everything the language needs
 * to wrap a generated `value` in its own `Definition` subclass.
 */
export type LangToDefinitionArgs<V extends GeneratedValue = GeneratedValue> = {
  context: GenerateContextType
  identifier: Identifier
  value: V
  noExport?: boolean
  description?: string
}

/**
 * Arguments for {@link Lang.toImport} — the import of one {@link Identifier}
 * from a module, the cross-file import a Driver registers when a generator
 * references a peer's Definition.
 */
export type LangToImportArgs = {
  identifier: Identifier
  module: string
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
 * - `toImport` — build the import of a single peer `Identifier` from a
 *   module (the Driver's cross-file import).
 *
 * There is deliberately no concise-import conversion here: the concise
 * vocabulary is intra-lang-package (each language's register function
 * converts its own form), so the neutral interface never names one.
 */
export type Lang = {
  /** Construct the language's file for `path`. */
  createFile: (args: { path: string; settings: ClientSettings | undefined }) => FileBase
  /** Wrap a generated `value` in this language's `Definition` subclass. */
  toDefinition: <V extends GeneratedValue>(args: LangToDefinitionArgs<V>) => DefinitionBase<V>
  /** Build the import of one peer `Identifier` from a module. */
  toImport: (args: LangToImportArgs) => ImportBase
}

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
 * Deliberately a CONCRETE constructor type, not a generic parameter: a core
 * factory generic over the base's instance type cannot type-safely extend it
 * (TS2415/TS2545 — see the scratch in `notes/lang/14`). The price is that
 * language-specific members beyond this contract are type-erased on
 * projection classes (present at runtime, invisible to the checker).
 */
export type LangSnippetConstructor = (new (args: SnippetBaseArgs) => SnippetBase) & { lang: Lang }
