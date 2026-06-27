import { CodeFileBase, matchDefinitions } from '@skmtc/core'
import { normalizeModuleName } from './normalizeModuleName.ts'
import type {
  ClientSettings,
  ModulePackage,
  DefinitionBase,
  ImportBase,
  ReExportBase,
  FindDefinitionsQuery
} from '@skmtc/core'
import { TsImport } from './TsImport.ts'
import { TsIdentifier } from './TsIdentifier.ts'
import type { TsEntityKind } from './createIdentifier.ts'
import type { TsLang } from './tsLang.ts'
import { TsReExport } from './TsReExport.ts'

/** A definition's TypeScript declaration kind, read off its identifier — the
 *  language-neutral `IdentifierBase` carries no `kind`, so narrow to the TS
 *  subclass. `undefined` for a non-TS identifier (shouldn't occur in a TsFile;
 *  treated as a kindless declaration). */
const declarationKind = (definition: DefinitionBase): TsEntityKind | undefined =>
  definition.identifier instanceof TsIdentifier ? definition.identifier.kind : undefined

/**
 * Constructor arguments for {@link TsFile}.
 */
export type TsFileArgs = {
  path: string
  settings: ClientSettings | undefined
}

/**
 * TypeScript's concrete code file. Owns the storage AND the dedup/merge
 * policy that the neutral {@link CodeFileBase} only declares: the name-keyed
 * definition map (with declaration-merging companions), the per-module import
 * and re-export merges, package-aware module-name normalisation, and the
 * rendering arrangement (re-exports, then imports, then definitions). Owns
 * what the engine's `File` rendered, byte-for-byte.
 */
export class TsFile extends CodeFileBase<TsLang> {
  /** Package configuration for cross-package module-name resolution. */
  packages: ModulePackage[] | undefined

  /**
   * Definitions keyed by identifier name — the cross-generator cache's
   * one-definition-per-name surface, read through {@link findDefinition}.
   */
  definitions: Map<string, DefinitionBase> = new Map()

  /** Imports keyed by {@link ImportBase.mergeKey} (the module path). */
  imports: Map<string, ImportBase> = new Map()

  /** Re-exports keyed by {@link ReExportBase.mergeKey} (the module path). */
  reExports: Map<string, ReExportBase> = new Map()

  /**
   * Same-name companion definitions — TypeScript declaration merging, e.g. a
   * `class Foo` and its `export declare namespace Foo`. Kept apart from the
   * name-keyed {@link definitions} map (so the cross-generator cache stays
   * one-definition-per-name) and rendered after the primaries.
   */
  mergedDefinitions: DefinitionBase[] = []

  constructor({ path, settings }: TsFileArgs) {
    super({ path })
    this.packages = settings?.packages
  }

  /**
   * TypeScript's duplication rule, keyed by the definition's *identifier*
   * (name + kind), not its rendered value. The first definition for a name is
   * the primary (the cross-generator cache resolves it). A later definition
   * reusing the name is:
   *
   * - the **same declaration** (same kind) → an idempotent no-op. Generators
   *   legitimately register the same helper from multiple call sites (e.g. a
   *   `columnHelper` const built once per table column), producing distinct
   *   objects that are the same `const` — those collapse to one.
   * - a **different kind** → a declaration-merging companion (a `class` + its
   *   `declare namespace`), rendered after the primaries.
   */
  override addDefinition(definition: DefinitionBase): void {
    const name = definition.identifier.name
    const kind = declarationKind(definition)
    const existing = this.definitions.get(name)

    if (existing === undefined) {
      this.definitions.set(name, definition)
      return
    }

    // Same name + same kind = the same declaration → collapse.
    if (declarationKind(existing) === kind) {
      return
    }
    // Already captured a companion of this kind for the name.
    if (
      this.mergedDefinitions.some(
        merged => merged.identifier.name === name && declarationKind(merged) === kind
      )
    ) {
      return
    }

    this.mergedDefinitions.push(definition)
  }

  /**
   * Merge imports in, collapsing any that share a `mergeKey()` (the module)
   * with an existing entry via {@link ImportBase.merge}. The neutral
   * `register` calls this; the keying + merge are TypeScript's own policy.
   */
  override addImports(incoming: ImportBase[]): void {
    for (const importEntry of incoming) {
      const key = importEntry.mergeKey()
      const existing = this.imports.get(key)

      this.imports.set(key, existing ? existing.merge(importEntry) : importEntry)
    }
  }

  /**
   * Merge re-exports in, collapsing any that share a `mergeKey()` (the module)
   * with an existing entry via {@link ReExportBase.merge}.
   */
  override addReExports(incoming: ReExportBase[]): void {
    for (const reExportEntry of incoming) {
      const key = reExportEntry.mergeKey()
      const existing = this.reExports.get(key)

      this.reExports.set(key, existing ? existing.merge(reExportEntry) : reExportEntry)
    }
  }

  /**
   * Query definitions by `name` and/or declaration `kind`. No query → all
   * (primaries + declaration-merging companions). The engine's read seam
   * (`findDefinitions({ name })?.[0]`) plus the generator/test inspection
   * surface (`findDefinitions({ type: 'class' })`).
   */
  override findDefinitions(query?: FindDefinitionsQuery<TsLang>): DefinitionBase[] | undefined {
    return matchDefinitions(
      [...this.definitions.values(), ...this.mergedDefinitions],
      query,
      identifier => (identifier instanceof TsIdentifier ? identifier.kind : undefined)
    )
  }

  override toString(): string {
    const reExports = Array.from(this.reExports.values()).map(reExportEntry => {
      // Re-exports land here as the neutral `ReExportBase`; in a
      // TypeScript file they are always `TsReExport`s. Re-key to the
      // package-normalised module at render time — the same arrangement
      // step the import section gets.
      if (!(reExportEntry instanceof TsReExport)) {
        return reExportEntry.toString()
      }

      const updatedModuleName = normalizeModuleName({
        destinationPath: this.path,
        exportPath: reExportEntry.module,
        packages: this.packages
      })

      return new TsReExport(updatedModuleName, reExportEntry.groups).toString()
    })

    const imports = Array.from(this.imports.values()).map(importEntry => {
      // Imports land here as the neutral `ImportBase`; in a TypeScript file
      // they are always `TsImport`s. Re-key to the package-normalised module
      // at render time (the engine normalised per-import in `File.toString`).
      if (!(importEntry instanceof TsImport)) {
        return importEntry.toString()
      }

      const updatedModuleName = this.packages
        ? normalizeModuleName({
            destinationPath: this.path,
            exportPath: importEntry.module,
            packages: this.packages
          })
        : importEntry.module

      return new TsImport(updatedModuleName, importEntry.specifiers).toString()
    })

    const definitions = [...this.definitions.values(), ...this.mergedDefinitions]

    const body = [reExports, imports, definitions]
      .filter(section => Boolean(section.length))
      .map(section => section.join('\n'))
      .join('\n\n')

    // `custom` is the neutral leading-content slot (formerly `banner`),
    // inherited from `FileBase`; render it above the body when set.
    return this.custom ? `${this.custom}\n\n${body}` : body
  }
}
