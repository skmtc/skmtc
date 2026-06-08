import { Import } from '@/dsl/Import.ts'
import type { ImportNameArg } from '@/dsl/Import.ts'
import { FileBase } from '@/dsl/FileBase.ts'
import type { Identifier } from '@/dsl/Identifier.ts'
import type { ClientSettings, ModulePackage } from '@/types/Settings.ts'
import invariant from 'tiny-invariant'

/**
 * Constructor arguments for {@link File}.
 */
type FileArgs = {
  /** The file path for the generated file */
  path: string
  /** Client settings containing package configuration */
  settings: ClientSettings | undefined
}

/**
 * Represents a TypeScript file in the SKMTC DSL system.
 *
 * The `File` class is a core component for generating TypeScript files with proper
 * import management, re-exports, and content organization. It automatically handles
 * module resolution, import optimization, and package-aware path normalization.
 *
 * ## Key Features
 *
 * - **Import Management**: Automatically tracks and organizes imports from other modules
 * - **Re-export Handling**: Supports re-exporting symbols from other modules
 * - **Package Awareness**: Handles module packages for complex project structures
 * - **Definition Tracking**: Manages code definitions and their relationships
 * - **Path Normalization**: Automatically resolves paths based on package configuration
 *
 * @example Basic file creation
 * ```typescript
 * import { File } from '@skmtc/core';
 *
 * const file = new File({
 *   path: './src/models/User.ts',
 *   settings: clientSettings
 * });
 *
 * // Add imports
 * file.imports.set('./types', new Set(['BaseModel', 'Validator']));
 *
 * // Add definitions
 * file.definitions.set('User', userInterface);
 *
 * // Generate file content
 * const content = file.toString();
 * console.log(content);
 * // import { BaseModel, Validator } from './types'
 * //
 * // export interface User extends BaseModel {
 * //   id: string;
 * //   name: string;
 * // }
 * ```
 *
 * @example With package configuration
 * ```typescript
 * const file = new File({
 *   path: './packages/client/src/api.ts',
 *   settings: {
 *     packages: [
 *       {
 *         rootPath: './packages/types',
 *         moduleName: '@myorg/types'
 *       }
 *     ]
 *   }
 * });
 *
 * // Import from another package
 * file.imports.set('./packages/types/models', new Set(['User']));
 *
 * // Will generate: import { User } from '@myorg/types/models'
 * ```
 *
 * @example Re-exports
 * ```typescript
 * const file = new File({
 *   path: './src/index.ts',
 *   settings: clientSettings
 * });
 *
 * // Add re-exports
 * file.reExports.set('./models', {
 *   'type': new Set(['User', 'Product']),
 *   'const': new Set(['DEFAULT_CONFIG'])
 * });
 *
 * // Will generate:
 * // export type { User, Product } from './models'
 * // export { DEFAULT_CONFIG } from './models'
 * ```
 */
export class File extends FileBase {
  /** The file type, always 'ts' for TypeScript files */
  fileType: 'ts' = 'ts'

  /** Map of module paths to re-exported symbols organized by export type */
  reExports: Map<string, Record<string, Set<string>>>

  /** Map of module paths to imported symbols */
  imports: Map<string, Set<string>>

  /** Package configuration for path resolution */
  packages: ModulePackage[] | undefined

  /**
   * Creates a new File instance.
   *
   * @param args - File configuration
   * @param args.path - The output path for this file
   * @param args.settings - Client settings containing package configuration
   *
   * @example
   * ```typescript
   * const file = new File({
   *   path: './src/generated/models.ts',
   *   settings: {
   *     packages: [
   *       { rootPath: './packages/shared', moduleName: '@company/shared' }
   *     ]
   *   }
   * });
   * ```
   */
  constructor({ path, settings }: FileArgs) {
    super({ path })
    this.reExports = new Map()
    this.imports = new Map()
    this.packages = settings?.packages
  }

  /**
   * Merge re-export entries into this file, grouped by entity type so the
   * renderer can pick `export type { … }` vs `export { … }`.
   *
   * This is the TypeScript-shaped half of the merge that previously lived
   * inline in `GenerateContext.register`. It now lives on the file (the
   * file owns its own state and merge semantics); the engine's `register`
   * calls it. Moves to `lang-typescript`'s `TsFile` in the language split.
   */
  addReExports(reExports: Record<string, Identifier[]>): void {
    Object.entries(reExports).forEach(([importModule, identifiers]) => {
      if (!this.reExports.get(importModule) && identifiers.length) {
        this.reExports.set(importModule, {})
      }

      identifiers.forEach(identifier => {
        const entityType = identifier.entityType.type

        const module = this.reExports.get(importModule)

        invariant(module, 'Module not found')

        if (!module[entityType]) {
          module[entityType] = new Set()
        }

        module[entityType].add(identifier.name)
      })
    })
  }

  /**
   * Merge import entries into this file, appending names to an existing
   * per-module import or creating a new one.
   *
   * The TypeScript-shaped import half of the former inline
   * `GenerateContext.register` merge — now owned by the file.
   */
  addImports(imports: Record<string, ImportNameArg[]>): void {
    Object.entries(imports).forEach(([importModule, importNames]) => {
      const module = this.imports.get(importModule)

      const importItem = new Import({ module: importModule, importNames })

      if (module) {
        importItem.importNames.forEach(name => module.add(`${name}`))
      } else {
        this.imports.set(importModule, new Set(importItem.importNames.map(name => `${name}`)))
      }
    })
  }

  /**
   * Generates the complete TypeScript file content.
   *
   * This method orchestrates the rendering of all file components in the correct order:
   * re-exports first, then imports, and finally definitions. It automatically handles
   * module path normalization based on package configuration and filters out empty sections.
   *
   * @returns The complete TypeScript file content as a string
   *
   * @example Basic file generation
   * ```typescript
   * const file = new File({ path: './api.ts', settings: undefined });
   *
   * // Add some imports and definitions
   * file.imports.set('./types', new Set(['User', 'Product']));
   * file.definitions.set('ApiClient', someDefinition);
   *
   * const content = file.toString();
   * console.log(content);
   * // import { User, Product } from './types'
   * //
   * // export class ApiClient {
   * //   // ... definition content
   * // }
   * ```
   *
   * @example With re-exports
   * ```typescript
   * const file = new File({ path: './index.ts', settings: undefined });
   *
   * file.reExports.set('./models', {
   *   'type': new Set(['User', 'Product']),
   *   'const': new Set(['DEFAULT_CONFIG'])
   * });
   *
   * const content = file.toString();
   * console.log(content);
   * // export type { User, Product } from './models'
   * // export { DEFAULT_CONFIG } from './models'
   * ```
   */
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

    const imports = Array.from(this.imports.entries()).map(([module, importItems]) => {
      const updatedModuleName = this.packages
        ? normalizeModuleName({
            destinationPath: this.path,
            exportPath: module,
            packages: this.packages
          })
        : module

      return new Import({ module: updatedModuleName, importNames: Array.from(importItems) })
    })

    const definitions = Array.from(this.definitions.values())

    return [reExports, imports, definitions]
      .filter(section => Boolean(section.length))
      .map(section => section.join('\n'))
      .join('\n\n')
  }
}

/**
 * Arguments for the {@link normalizeModuleName} function.
 */
export type NormalizeModuleNameArgs = {
  /** The path of the file that will contain the import/export */
  destinationPath: string
  /** The original path being imported/exported from */
  exportPath: string
  /** Package configuration for path resolution */
  packages: ModulePackage[] | undefined
}

/**
 * Normalizes module import/export paths based on package configuration.
 *
 * This function handles path resolution for complex project structures with multiple
 * packages. It converts file system paths to appropriate module names based on:
 * - Whether the destination and export paths are in the same package
 * - Package-specific module naming conventions
 * - Root path truncation for intra-package imports
 *
 * @param args - Path normalization arguments
 * @param args.destinationPath - The path of the file that will contain the import/export
 * @param args.exportPath - The original path being imported/exported from
 * @param args.packages - Package configuration for path resolution (defaults to empty array)
 * @returns The normalized module name to use in import/export statements
 *
 * @throws {Error} When a matching package is found but has no moduleName configured
 *
 * @example Cross-package import
 * ```typescript
 * const normalized = normalizeModuleName({
 *   destinationPath: './packages/client/src/api.ts',
 *   exportPath: './packages/types/models/User.ts',
 *   packages: [
 *     { rootPath: './packages/types', moduleName: '@company/types' },
 *     { rootPath: './packages/client', moduleName: '@company/client' }
 *   ]
 * });
 * console.log(normalized); // '@company/types'
 * ```
 *
 * @example Intra-package import (same package)
 * ```typescript
 * const normalized = normalizeModuleName({
 *   destinationPath: './packages/types/src/index.ts',
 *   exportPath: './packages/types/models/User.ts',
 *   packages: [
 *     { rootPath: './packages/types', moduleName: '@company/types' }
 *   ]
 * });
 * console.log(normalized); // '@/models/User.ts' (truncates root path)
 * ```
 *
 * @example No package match (returns original path)
 * ```typescript
 * const normalized = normalizeModuleName({
 *   destinationPath: './src/index.ts',
 *   exportPath: './src/utils.ts',
 *   packages: []
 * });
 * console.log(normalized); // './src/utils.ts'
 * ```
 */
export const normalizeModuleName = ({
  destinationPath,
  exportPath,
  packages = []
}: NormalizeModuleNameArgs): string => {
  const matchingModule = packages.find(packageModule => {
    return exportPath.startsWith(packageModule.rootPath)
  })

  if (!matchingModule) {
    return exportPath
  }

  const { rootPath, moduleName } = matchingModule

  // When importing from within same package, truncate the root path and denote root with '@'
  if (destinationPath.startsWith(rootPath)) {
    return exportPath.replace(rootPath, '@')
  }

  if (!moduleName) {
    throw new Error(`Module name is not set for ${rootPath}`)
  }

  return moduleName
}
