import { FileBase } from '@/dsl/FileBase.ts'
import type { DefinitionBase } from '@/dsl/Definition.ts'
import type { IdentifierBase } from '@/dsl/IdentifierBase.ts'
import type { ImportBase } from '@/dsl/ImportBase.ts'
import type { ReExportBase } from '@/dsl/ReExportBase.ts'
import type { PendingDefinition } from '@/dsl/PendingDefinition.ts'

/**
 * Query for {@link CodeFileBase.findDefinitions}. `name` filters by identifier
 * name; `type` filters by the declaration type as the opaque-boundary
 * `string`. A lang's concrete file narrows the override to its own
 * `XxEntityType` (`'class'` / `'interface'` / … for TypeScript). Omit both to
 * return every definition.
 */
export type FindDefinitionsQuery = {
  type?: string
  name?: string
}

/**
 * The neutral name/type filter every language's `findDefinitions` shares. The
 * language passes its definition list and a `typeOf` extractor — the one
 * lang-specific bit, which narrows to the language's Identifier subclass to
 * read the typed `type` (returned here as the opaque `string`).
 *
 * - no `name` and no `type` → returns `all` (the whole list; the former
 *   `listDefinitions`).
 * - otherwise → the matching subset, or `undefined` when nothing matches.
 */
export const matchDefinitions = (
  all: DefinitionBase[],
  query: FindDefinitionsQuery | undefined,
  typeOf: (identifier: IdentifierBase) => string | undefined
): DefinitionBase[] | undefined => {
  const name = query?.name
  const type = query?.type

  if (name === undefined && type === undefined) {
    return all
  }

  const matches = all.filter(definition => {
    const nameMatches = name === undefined || definition.identifier.name === name
    const typeMatches = type === undefined || typeOf(definition.identifier) === type
    return nameMatches && typeMatches
  })

  return matches.length > 0 ? matches : undefined
}

/**
 * The base every language's *code* file extends — a {@link FileBase} that
 * coordinates definitions, imports, and re-exports. (`JsonFile`, with none of
 * these, extends {@link FileBase} directly.)
 *
 * Language-blind: the declaration type {@link findDefinitions} filters on is
 * the opaque-boundary `string` here; a lang's concrete file narrows its own
 * `findDefinitions` override to its `XxEntityType`.
 *
 * Pure contract — no fields, no merge logic. Storage AND the duplication/merge
 * policy are language-specific and live in the concrete lang subclass; the
 * engine speaks only these four neutral operations — three writers driven by
 * `register`, plus {@link findDefinitions}, the read seam the cross-generator
 * cache and file inspection use. The cache resolves a single primary by name
 * via `findDefinitions({ name })?.[0]`.
 */
export abstract class CodeFileBase extends FileBase {
  /**
   * Add an entry, applying the language's duplication rule (e.g. TypeScript
   * declaration merging). Called by the engine's `register` and the
   * `ModelDriver`. Narrow with `isPending()`:
   *
   * - A pending entry (a model whose projection is about to be constructed)
   *   takes the slot its Definition will have. `findPendingDefinitions` finds
   *   it; `findDefinitions` and render do not. See {@link PendingDefinition}.
   * - A Definition whose slot holds that model's pending entry (same generator
   *   key) becomes the entry: the same slot. Another generator's Definition
   *   there is a `Registered definition mismatch`.
   * - A Definition renders after every Definition added before it, so a
   *   declaration lands after the models it refers to.
   */
  abstract addDefinition(entry: DefinitionBase | PendingDefinition): void

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
   * `undefined` when nothing matches. `type` is the declaration type as the
   * opaque `string`; a lang's concrete file may narrow it. Implement with
   * {@link matchDefinitions}.
   */
  abstract findDefinitions(query?: FindDefinitionsQuery): DefinitionBase[] | undefined

  /** Take a pending entry out: its projection's constructor threw. */
  abstract removePendingDefinition(pending: PendingDefinition): void

  /** The pending entries, all of them or those named `name`. */
  abstract findPendingDefinitions(name?: string): PendingDefinition[]
}
