import { CodeFileBase, normalizeModuleName } from '@skmtc/core'
import type { ClientSettings, Identifier, ImportBase, ModulePackage } from '@skmtc/core'
import { TsImport } from './TsImport.ts'

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

  /** Re-exported symbols, grouped by module then entity type. */
  reExports: Map<string, Record<string, Set<string>>> = new Map()

  constructor({ path, settings }: TsFileArgs) {
    super({ path })
    this.packages = settings?.packages
  }

  /**
   * Merge re-export entries in, grouped by entity type so the renderer can
   * pick `export type { … }` vs `export { … }`.
   */
  addReExports(reExports: Record<string, Identifier[]>): void {
    for (const [importModule, identifiers] of Object.entries(reExports)) {
      if (identifiers.length === 0) {
        continue
      }

      let moduleEntry = this.reExports.get(importModule)
      if (!moduleEntry) {
        moduleEntry = {}
        this.reExports.set(importModule, moduleEntry)
      }

      for (const identifier of identifiers) {
        const entityType = identifier.entityType.type
        if (!moduleEntry[entityType]) {
          moduleEntry[entityType] = new Set()
        }
        moduleEntry[entityType].add(identifier.name)
      }
    }
  }

  override toString(): string {
    const reExports = Array.from(this.reExports.entries()).flatMap(([module, entityTypes]) => {
      const updatedModuleName = normalizeModuleName({
        destinationPath: this.path,
        exportPath: module,
        packages: this.packages
      })

      return Object.entries(entityTypes).map(([entityType, names]) => {
        const prefix = entityType === 'type' ? 'type' : ''

        return `export ${prefix} { ${Array.from(names).join(', ')} } from '${updatedModuleName}'`
      })
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

    return [reExports, imports, definitions]
      .filter(section => Boolean(section.length))
      .map(section => section.join('\n'))
      .join('\n\n')
  }
}
