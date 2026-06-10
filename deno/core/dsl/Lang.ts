import type { DefinitionBase } from '@/dsl/Definition.ts'
import type { FileBase } from '@/dsl/FileBase.ts'
import type { ImportBase } from '@/dsl/ImportBase.ts'
import type { Identifier } from '@/dsl/Identifier.ts'
import type { GeneratedValue } from '@/dsl/GeneratedValue.ts'
import type { ImportNameArg } from '@/dsl/Import.ts'
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
 * A `Lang` is the object a `@skmtc/lang-*` package exposes. A generator
 * binds it to its projection base (`toModelProjectionBase({ lang })`) and
 * its snippet base (`extends TypescriptSnippet`); the engine then reads it
 * off the projection class (`projection.lang`) and the projection instance
 * (`this.lang`). The engine never names a concrete `File` / `Definition` /
 * `Import` — it only ever calls these four neutral factories:
 *
 * - `createFile` — construct this language's file for a path.
 * - `toDefinition` — wrap a generated value in this language's `Definition`.
 * - `toImports` — convert the concise, generator-facing import form
 *   (`{ 'zod': ['z'] }`) into this language's `ImportBase` objects. The
 *   concise/TS-shaped vocabulary lives only here, at the conversion seam.
 * - `toImport` — build the import of a single peer `Identifier` from a
 *   module (the Driver's cross-file import).
 */
export type Lang = {
  /** Construct the language's file for `path`. */
  createFile: (args: { path: string; settings: ClientSettings | undefined }) => FileBase
  /** Wrap a generated `value` in this language's `Definition` subclass. */
  toDefinition: <V extends GeneratedValue>(args: LangToDefinitionArgs<V>) => DefinitionBase<V>
  /** Convert the concise import form into this language's `ImportBase` objects. */
  toImports: (imports: Record<string, ImportNameArg[]>) => ImportBase[]
  /** Build the import of one peer `Identifier` from a module. */
  toImport: (args: LangToImportArgs) => ImportBase
}

/**
 * A snippet that carries its language. SPIKE (option 2 — see
 * `notes/lang/14`): language packages export a snippet base satisfying
 * this shape (`TsSnippet`); it is where language enters the DSL class
 * hierarchy. `SnippetBase` itself stays language-blind.
 */
export type LangSnippet = SnippetBase & { lang: Lang }

/**
 * The constructor contract a language's snippet base class must satisfy to
 * be used as the `base` of a projection-base factory
 * (`toModelProjectionBase({ base: TsSnippet, … })`).
 *
 * Both sides carry the language: the **instance** `lang` serves the register
 * helpers (`this.lang`), and the **static** `lang` serves the Drivers, which
 * need the peer's language *before* constructing the value (cache-hit path).
 * The static is inherited by every class built on this base, so a generator's
 * projection class exposes `lang` automatically.
 *
 * Deliberately a CONCRETE constructor type, not a generic parameter: a core
 * factory generic over the base's instance type cannot type-safely extend it
 * (TS2415/TS2545 — see the scratch in `notes/lang/14`). The price is that
 * language-specific members beyond this contract are type-erased on
 * projection classes (present at runtime, invisible to the checker).
 */
export type LangSnippetCtor = (new (args: SnippetBaseArgs) => LangSnippet) & { lang: Lang }
