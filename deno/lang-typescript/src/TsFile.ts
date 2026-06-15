import { CodeFileBase } from '@skmtc/core'
import { normalizeModuleName } from './normalizeModuleName.ts'
import type { ClientSettings, ModulePackage } from '@skmtc/core'
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

  constructor({ path, settings }: TsFileArgs) {
    super({ path })
    this.packages = settings?.packages
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

    const definitions = Array.from(this.definitions.values())

    const body = [reExports, imports, definitions]
      .filter(section => Boolean(section.length))
      .map(section => section.join('\n'))
      .join('\n\n')

    return this.banner ? `${this.banner}\n\n${body}` : body
  }
}
