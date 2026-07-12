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
 * `identifier` is the neutral {@link IdentifierBase}: the engine holds
 * identifiers as the base and passes that to the factory, which narrows to
 * its own concrete subclass via `instanceof`.
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
 * (`TsIdentifier` / `KtIdentifier`), reading the opaque `type` into its
 * typed `EntityType` slot.
 */
export type LangToIdentifierArgs = {
  name: string
  type: string
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
export type Lang = {
  /** Construct the language's file for `path`. */
  createFile: (args: { path: string; settings: ClientSettings | undefined }) => FileBase
  /** Wrap a generated `value` in this language's `Definition` subclass. */
  toDefinition: <V extends GeneratedValue>(args: LangToDefinitionArgs<V>) => DefinitionBase<V>
  /** Build the import of one peer `IdentifierBase` from a module. */
  toImport: (args: LangToImportArgs) => ImportBase
  /**
   * Assemble this language's `IdentifierBase` subclass from name +
   * type/typeName/exported. `type` arrives as the opaque-boundary `string` — the
   * engine never narrows it; the language reads it into its own typed
   * `EntityType` slot. The engine holds the result as the neutral
   * `IdentifierBase`; the declaration-type vocabulary is a fixed fact of each
   * language package, never modelled or recovered here.
   */
  toIdentifier: (args: LangToIdentifierArgs) => IdentifierBase
}

/**
 * The constructor contract a language's snippet base class must satisfy to
 * be used as the `base` of a projection-base factory
 * (`toModelProjectionBase(TsSnippet, …)`). It is where language
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
 * classes. The static `lang` is the neutral {@link Lang} — the engine reads
 * it language-blind; each lang package's concrete declaration-type vocabulary
 * is a fixed fact of that package, never recovered through this type.
 */
export type LangSnippetConstructor = (new (args: SnippetBaseArgs) => SnippetBase) & { lang: Lang }
