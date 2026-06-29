import { CodeFileBase, matchDefinitions } from '@skmtc/core'
import { normalizeModuleName } from './normalizeModuleName.ts'
import type { ClientSettings, ModulePackage, DefinitionBase } from '@skmtc/core'
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
   */
  definitions: Map<string, TsDefinition> = new Map()

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
   */
  override addDefinition(definition: TsDefinition): void {
    const key = definition.identifier.declarationKey()

    if (!this.definitions.has(key)) {
      this.definitions.set(key, definition)
    }
  }

  /**
   * Merge imports in, collapsing any that share a `mergeKey()` (the module)
   * with an existing entry via {@link TsImport.merge}. The neutral
   * `register` calls this; the keying + merge are TypeScript's own policy.
   */
  override addImports(incoming: TsImport[]): void {
    for (const importEntry of incoming) {
      const key = importEntry.mergeKey()
      const existing = this.imports.get(key)

      this.imports.set(key, existing ? existing.merge(importEntry) : importEntry)
    }
  }

  /**
   * Merge re-exports in, collapsing any that share a `mergeKey()` (the module)
   * with an existing entry via {@link TsReExport.merge}.
   */
  override addReExports(incoming: TsReExport[]): void {
    for (const reExportEntry of incoming) {
      const key = reExportEntry.mergeKey()
      const existing = this.reExports.get(key)

      this.reExports.set(key, existing ? existing.merge(reExportEntry) : reExportEntry)
    }
  }

  /**
   * Query definitions by `name` and/or declaration `type`. No query → every
   * definition. The cross-generator cache's read seam
   * (`findDefinitions({ name })?.[0]` → the first-registered definition for a
   * name) plus the generator/test inspection surface
   * (`findDefinitions({ type: 'class' })`).
   */
  override findDefinitions(query?: { name?: string; type?: TsEntityType }): DefinitionBase[] | undefined {
    return matchDefinitions(
      [...this.definitions.values()],
      query,
      identifier => (identifier instanceof TsIdentifier ? identifier.type : undefined)
    )
  }

  override toString(): string {
    const reExports = Array.from(this.reExports.values()).map(reExportEntry => {
      // Re-key to the package-normalised module at render time — the same
      // arrangement step the import section gets.
      const updatedModuleName = normalizeModuleName({
        destinationPath: this.path,
        exportPath: reExportEntry.module,
        packages: this.packages
      })

      return new TsReExport(updatedModuleName, reExportEntry.groups).toString()
    })

    const imports = Array.from(this.imports.values()).map(importEntry => {
      // Re-key to the package-normalised module at render time (the engine
      // normalised per-import in `File.toString`).
      const updatedModuleName = this.packages
        ? normalizeModuleName({
            destinationPath: this.path,
            exportPath: importEntry.module,
            packages: this.packages
          })
        : importEntry.module

      return new TsImport(updatedModuleName, importEntry.specifiers).toString()
    })

    const definitions = [...this.definitions.values()]

    const body = [reExports, imports, definitions]
      .filter(section => Boolean(section.length))
      .map(section => section.join('\n'))
      .join('\n\n')

    // `custom` is the neutral leading-content slot (formerly `banner`),
    // inherited from `FileBase`; render it above the body when set.
    return this.custom ? `${this.custom}\n\n${body}` : body
  }
}
