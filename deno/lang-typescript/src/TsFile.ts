import { CodeFileBase } from '@skmtc/core'
import { normalizeModuleName } from './normalizeModuleName.ts'
import type { ClientSettings, ModulePackage, DefinitionBase } from '@skmtc/core'
import { TsImport } from './TsImport.ts'
import { TsReExport } from './TsReExport.ts'

/**
 * Constructor arguments for {@link TsFile}.
 */
export type TsFileArgs = {
  path: string
  settings: ClientSettings | undefined
}

/**
 * TypeScript's concrete code file. Inherits the neutral import collection +
 * merge from {@link CodeFileBase} and adds the TypeScript-specific pieces:
 * re-exports, package-aware module-name normalisation, and the rendering
 * arrangement (re-exports, then imports, then definitions). Owns what the
 * engine's `File` rendered, byte-for-byte.
 */
export class TsFile extends CodeFileBase {
  /** Package configuration for cross-package module-name resolution. */
  packages: ModulePackage[] | undefined

  /**
   * Optional leading banner — a file-level comment (e.g. a codegen header)
   * rendered above the re-exports/imports/definitions. Set through the
   * register vocabulary's `banner` field; see {@link register}.
   */
  banner: string | undefined

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
   * TypeScript's duplication rule. The first definition for a name is the
   * primary (the cross-generator cache resolves it); re-adding the *same*
   * object is an idempotent no-op; a *different* definition reusing the name
   * is a declaration-merging companion (a class + its `declare namespace`),
   * rendered after the primaries.
   */
  override addDefinition(definition: DefinitionBase): void {
    const name = definition.identifier.name
    const existing = this.definitions.get(name)

    if (existing === undefined) {
      this.definitions.set(name, definition)
      return
    }

    if (existing !== definition && !this.mergedDefinitions.includes(definition)) {
      this.mergedDefinitions.push(definition)
    }
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

    return this.banner ? `${this.banner}\n\n${body}` : body
  }
}
