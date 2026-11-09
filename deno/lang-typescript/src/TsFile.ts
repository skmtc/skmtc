import { CodeFileBase, matchDefinitions } from '@skmtc/core'
import { toImportModule } from './toImportModule.ts'
import type { ClientSettings, ModulePackage, DefinitionBase, IdentifierBase, PendingDefinition } from '@skmtc/core'
import { TsImport } from './TsImport.ts'
import type { TsDefinition } from './TsDefinition.ts'
import { TsIdentifier } from './TsIdentifier.ts'
import type { TsEntityType } from './createIdentifier.ts'
import { TsReExport } from './TsReExport.ts'

/**
 * Constructor arguments for {@link TsFile}.
 */
export type TsFileArgs = {
  path: string
  settings: ClientSettings | undefined
}

/**
 * TypeScript's concrete code file. Owns the storage AND the dedup/merge
 * policy that the neutral {@link CodeFileBase} only declares: the definition
 * map keyed by each identifier's declaration slot
 * ({@link TsIdentifier.declarationKey}, so a `class Foo` and a `declare
 * namespace Foo` co-exist), the per-module import and re-export merges,
 * package-aware module-name normalisation, and the rendering arrangement
 * (re-exports, then imports, then definitions). Owns what the engine's `File`
 * rendered, byte-for-byte.
 */
export class TsFile extends CodeFileBase {
  /** Package configuration for cross-package module-name resolution. */
  packages: ModulePackage[] | undefined

  /**
   * Definitions keyed by each identifier's declaration slot
   * ({@link TsIdentifier.declarationKey} — `(type, name)`). A later definition
   * for a slot already taken collapses into the first; distinct slots that
   * share a name (a `class Foo` and a `declare namespace Foo`) both live here
   * — that is how TypeScript declaration merging is represented, no separate
   * collection needed. The cross-generator cache resolves a name to its
   * first-registered definition through {@link findDefinitions}.
   *
   * A model's slot holds its pending entry while its projection is being
   * constructed, and then its Definition ({@link addDefinition}).
   *
   * The map's order is the render order: each Definition in the order it was
   * added. A model's Definition replaces its pending entry and moves to the
   * end, so it lands after the models its constructor added before it, or a
   * `const` would read one before it is defined.
   */
  definitions: Map<string, TsDefinition | PendingDefinition> = new Map()

  /** Imports keyed by {@link TsImport.mergeKey} (the module path). */
  imports: Map<string, TsImport> = new Map()

  /** Re-exports keyed by {@link TsReExport.mergeKey} (the module path). */
  reExports: Map<string, TsReExport> = new Map()

  constructor({ path, settings }: TsFileArgs) {
    super({ path })
    this.packages = settings?.packages
  }

  /**
   * TypeScript's duplication rule, keyed by the identifier's declaration slot
   * ({@link TsIdentifier.declarationKey} — `(type, name)`), not its rendered
   * value. The first definition for a slot wins; a later definition for the
   * same slot is the same declaration and collapses to a no-op — e.g. a
   * `columnHelper` const independently registered per table column (distinct
   * objects, same `const`), or a type alias re-registered with a different
   * value (the identifier, not the value, is the key). Definitions that share
   * a name but differ in type occupy *different* slots and both render — that
   * is TypeScript declaration merging (a `class Foo` and its `declare
   * namespace Foo`).
   *
   * A pending entry (a model whose projection is about to be constructed)
   * takes its slot and does not render. The model's Definition, added when
   * the constructor returns, replaces the pending entry and moves to the end
   * of the map: the one exception to "first wins". Render follows the map,
   * so it follows the order Definitions were added.
   */
  override addDefinition(entry: TsDefinition | PendingDefinition): void {
    const key = toDeclarationKey(entry.identifier)
    const current = this.definitions.get(key)

    if (current === undefined) {
      this.definitions.set(key, entry)

      return
    }

    // The Driver looks a model up before it marks it pending: a pending entry
    // for a taken slot is an engine bug.
    if (entry.isPending()) {
      throw new Error(`'${entry.identifier.name}' already has a declaration in '${this.path}'`)
    }

    // The model's Definition replaces its pending entry. Deleting first moves
    // it to the end of the map, after every Definition added before it.
    if (current.isPending()) {
      if (current.generatorKey !== entry.generatorKey) {
        throw new Error(
          `Registered definition mismatch: '${entry.identifier.name}' in file '${this.path}'. Pending key '${current.generatorKey}' does not match new key '${entry.generatorKey}'`
        )
      }

      this.definitions.delete(key)
      this.definitions.set(key, entry)
    }

    // Otherwise the slot holds a Definition: the first one wins (see above).
  }

  override removePendingDefinition(pending: PendingDefinition): void {
    const key = toDeclarationKey(pending.identifier)

    if (this.definitions.get(key) === pending) {
      this.definitions.delete(key)
    }
  }

  override findPendingDefinitions(name?: string): PendingDefinition[] {
    return [...this.definitions.values()].filter(
      (entry): entry is PendingDefinition => entry.isPending() && (name === undefined || entry.identifier.name === name)
    )
  }

  /**
   * Merge imports in, collapsing any that share a `mergeKey()` (the module)
   * with an existing entry via {@link TsImport.merge}. The neutral
   * `register` calls this; the keying + merge are TypeScript's own policy.
   */
  override addImports(incoming: TsImport[]): void {
    mergeInto(this.imports, incoming, (existing, entry) => existing.merge(entry))
  }

  /**
   * Merge re-exports in, collapsing any that share a `mergeKey()` (the module)
   * with an existing entry via {@link TsReExport.merge}.
   */
  override addReExports(incoming: TsReExport[]): void {
    mergeInto(this.reExports, incoming, (existing, entry) => existing.merge(entry))
  }

  /**
   * Query definitions by `name` and/or declaration `type`. No query → every
   * definition. The cross-generator cache's read seam
   * (`findDefinitions({ name })?.[0]` → the first-registered definition for a
   * name) plus the generator/test inspection surface
   * (`findDefinitions({ type: 'class' })`).
   */
  override findDefinitions(query?: {
    name?: string
    type?: TsEntityType
  }): DefinitionBase[] | undefined {
    return matchDefinitions(this.#constructedDefinitions(), query, identifier =>
      identifier instanceof TsIdentifier ? identifier.type : undefined
    )
  }

  /** The Definitions in the order they were added, leaving out pending entries. */
  #constructedDefinitions(): TsDefinition[] {
    return [...this.definitions.values()].filter((entry): entry is TsDefinition => !entry.isPending())
  }

  /**
   * Definitions in render order: primaries first (the order each was added:
   * a model's when its constructor returned), then
   * same-name companions. A companion is a definition whose name an earlier
   * definition already claimed under a different declaration kind — e.g. a
   * `declare namespace Foo` companion of `class Foo`. TypeScript declaration
   * merging lays the companion *after* the primary (Stainless: `class … } …
   * declare namespace Foo`), so it's deferred to the end no matter when it was
   * registered. The first definition seen for a name is the primary.
   */
  #orderedDefinitions(): TsDefinition[] {
    const seenNames = new Set<string>()
    const primaries: TsDefinition[] = []
    const companions: TsDefinition[] = []
    for (const definition of this.#constructedDefinitions()) {
      if (seenNames.has(definition.identifier.name)) {
        companions.push(definition)
      } else {
        seenNames.add(definition.identifier.name)
        primaries.push(definition)
      }
    }

    return [...primaries, ...companions]
  }

  override toString(): string {
    // Render-time normalization can send several entries to one module
    // (two spellings of one artifact; several artifacts of one subpath
    // export), so entries are re-grouped by the normalized module and
    // merged before rendering — one statement per module.
    const reExports = new Map<string, TsReExport>()

    mergeInto(
      reExports,
      Array.from(this.reExports.values()).map(
        reExportEntry =>
          new TsReExport(this.#toRenderedModule(reExportEntry.module), reExportEntry.groups)
      ),
      (existing, entry) => existing.merge(entry)
    )

    const imports = new Map<string, TsImport>()

    mergeInto(
      imports,
      Array.from(this.imports.values()).map(
        importEntry =>
          new TsImport(this.#toRenderedModule(importEntry.module), importEntry.specifiers)
      ),
      (existing, entry) => existing.merge(entry)
    )

    const definitions = this.#orderedDefinitions()

    const body = [
      Array.from(reExports.values()).map(reExportEntry => reExportEntry.toString()),
      Array.from(imports.values()).map(importEntry => importEntry.toString()),
      definitions.map(definition => definition.toString())
    ]
      .filter(section => Boolean(section.length))
      .map(section => section.join('\n'))
      .join('\n\n')

    // `custom` is the neutral leading-content slot (formerly `banner`),
    // inherited from `FileBase`; render it above the body when set.
    return this.custom ? `${this.custom}\n\n${body}` : body
  }

  /** The module as this file writes it: rewritten by package when `packages` is set. */
  #toRenderedModule(module: string): string {
    return this.packages
      ? toImportModule({
          destinationPath: this.path,
          module,
          packages: this.packages
        })
      : module
  }
}

/**
 * Merges `incoming` into `target` keyed by `mergeKey()` (the module): an
 * entry whose module is already present is merged into the existing one.
 */
const mergeInto = <Entry extends { mergeKey(): string }>(
  target: Map<string, Entry>,
  incoming: Entry[],
  merge: (existing: Entry, entry: Entry) => Entry
): void => {
  for (const entry of incoming) {
    const key = entry.mergeKey()
    const existing = target.get(key)

    target.set(key, existing ? merge(existing, entry) : entry)
  }
}

/** A pending entry's slot: the declaration key its Definition will have. */
const toDeclarationKey = (identifier: IdentifierBase): string => {
  if (!(identifier instanceof TsIdentifier)) {
    throw new Error(`'${identifier.name}' has no TypeScript identifier, so it has no declaration slot`)
  }

  return identifier.declarationKey()
}
