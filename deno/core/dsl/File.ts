import { Import } from './Import.ts'
import type { Definition } from './Definition.ts'
import type { ClientSettings, ModulePackage } from '../types/Settings.ts'

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
export class File {
  /** The file type, always 'ts' for TypeScript files */
  fileType: 'ts' = 'ts'
  
  /** The file path for this generated file */
  path: string
  
  /** Map of module paths to re-exported symbols organized by export type */
  reExports: Map<string, Record<string, Set<string>>>
  
  /** Map of module paths to imported symbols */
  imports: Map<string, Set<string>>
  
  /** Map of definition names to their Definition objects */
  definitions: Map<string, Definition>
  
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
    this.path = path
    this.reExports = new Map()
    this.imports = new Map()
    this.definitions = new Map()
    this.packages = settings?.packages
  }

  toString(): string {
    const reExports = Array.from(this.reExports.entries()).flatMap(([module, entityTypes]) => {
      const updatedModuleName = normaliseModuleName({
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
        ? normaliseModuleName({
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

export type NormaliseModuleNameArgs = {
  destinationPath: string
  exportPath: string
  packages: ModulePackage[] | undefined
}

export const normaliseModuleName = ({
  destinationPath,
  exportPath,
  packages = []
}: NormaliseModuleNameArgs) => {
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
