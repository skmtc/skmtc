import { FileBase } from '@/dsl/FileBase.ts'
import type { DefinitionBase } from '@/dsl/Definition.ts'
import type { IdentifierBase } from '@/dsl/IdentifierBase.ts'
import type { Lang, LangKind } from '@/dsl/Lang.ts'
import type { ImportBase } from '@/dsl/ImportBase.ts'
import type { ReExportBase } from '@/dsl/ReExportBase.ts'

/**
 * Query for {@link CodeFileBase.findDefinitions}. `name` filters by identifier
 * name; `type` filters by the language's declaration kind ({@link LangKind},
 * inferred from the file's {@link Lang} — `'class'` / `'interface'` / … for
 * TypeScript). Omit both to return every definition.
 */
export type FindDefinitionsQuery<L extends Lang> = {
  type?: LangKind<L>
  name?: string
}

/**
 * The neutral name/kind filter every language's `findDefinitions` shares. The
 * language passes its definition list and a `kindOf` extractor — the one
 * lang-specific bit, which narrows to the language's Identifier subclass to
 * read the typed `kind`.
 *
 * - no `name` and no `type` → returns `all` (the whole list; the former
 *   `listDefinitions`).
 * - otherwise → the matching subset, or `undefined` when nothing matches.
 */
export const matchDefinitions = <L extends Lang>(
  all: DefinitionBase[],
  query: FindDefinitionsQuery<L> | undefined,
  kindOf: (identifier: IdentifierBase) => LangKind<L> | undefined
): DefinitionBase[] | undefined => {
  const name = query?.name
  const type = query?.type

  if (name === undefined && type === undefined) {
    return all
  }

  const matches = all.filter(definition => {
    const nameMatches = name === undefined || definition.identifier.name === name
    const typeMatches = type === undefined || kindOf(definition.identifier) === type
    return nameMatches && typeMatches
  })

  return matches.length > 0 ? matches : undefined
}

/**
 * The base every language's *code* file extends — a {@link FileBase} that
 * coordinates definitions, imports, and re-exports. (`JsonFile`, with none of
 * these, extends {@link FileBase} directly.)
 *
 * Generic over the file's language {@link Lang} (`CodeFileBase<TsLang>`) — the
 * source of the typed declaration kind ({@link LangKind}) that
 * {@link findDefinitions} filters on. The parameter is **required**: a code
 * file always belongs to a concrete language.
 *
 * Pure contract — no fields, no merge logic. Storage AND the duplication/merge
 * policy are language-specific and live in the concrete lang subclass; the
 * engine speaks only these four neutral operations — three writers driven by
 * `register`, plus {@link findDefinitions}, the read seam the cross-generator
 * cache and file inspection use. The cache resolves a single primary by name
 * via `findDefinitions({ name })?.[0]`.
 */
export abstract class CodeFileBase<L extends Lang> extends FileBase {
  /**
   * Add a definition, applying the language's duplication rule (e.g.
   * TypeScript declaration merging). Called by the engine's `register`.
   */
  abstract addDefinition(definition: DefinitionBase): void

  /**
   * Merge imports in, applying the language's collapse rule (typically
   * keyed by {@link ImportBase.mergeKey} and combined via
   * {@link ImportBase.merge}). Called by the engine's `register`.
   */
  abstract addImports(imports: ImportBase[]): void

  /**
   * Merge re-exports in, applying the language's collapse rule. Called by the
   * engine's `register`; a language without re-exports never receives any.
   */
  abstract addReExports(reExports: ReExportBase[]): void

  /**
   * Query the file's definitions. With no `name`/`type` → every definition (an
   * array; the neutral "list all" used to inspect a file, e.g. assert the
   * peer-dedup invariant). With `name` and/or `type` → the matching subset, or
   * `undefined` when nothing matches. `type` is the language's declaration
   * kind, inferred from {@link Lang}. Implement with {@link matchDefinitions}.
   */
  abstract findDefinitions(query?: FindDefinitionsQuery<L>): DefinitionBase[] | undefined
}
