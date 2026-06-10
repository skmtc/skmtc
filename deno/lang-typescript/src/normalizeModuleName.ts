import type { ModulePackage } from '@skmtc/core'

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
 * This function handles path resolution for complex project structures with
 * multiple packages. It converts file system paths to appropriate module
 * names based on:
 * - Whether the destination and export paths are in the same package
 * - Package-specific module naming conventions
 * - Root path truncation for intra-package imports
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
