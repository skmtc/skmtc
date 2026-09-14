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
 * Package roots may nest. A nested root is a **subpath export** of the
 * package that contains it: files under it share the outer package's `@`
 * alias, and a file outside the package imports them by the nested root's
 * `moduleName` — `@company/sdk/models` rather than `@company/sdk`. So the
 * outermost root containing the target decides whether an import is
 * intra-package, and the innermost decides what an outside importer writes.
 * The order of `packages` does not matter.
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
 * @example Subpath export (nested roots)
 * ```typescript
 * const packages = [
 *   { rootPath: './packages/sdk/src', moduleName: '@company/sdk' },
 *   { rootPath: './packages/sdk/src/models', moduleName: '@company/sdk/models' }
 * ];
 * normalizeModuleName({
 *   destinationPath: './packages/sdk/src/client/getUser.ts',
 *   exportPath: './packages/sdk/src/models/User.ts',
 *   packages
 * }); // '@/models/User.ts' — inside the package, one alias
 * normalizeModuleName({
 *   destinationPath: './apps/api/src/routes/users.ts',
 *   exportPath: './packages/sdk/src/models/User.ts',
 *   packages
 * }); // '@company/sdk/models' — outside it, the subpath
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
  // Every root the target sits under, outermost first.
  const containing = packages
    .map(packageModule => ({ ...packageModule, rootPath: trimSlash(packageModule.rootPath) }))
    .filter(packageModule => isUnder(exportPath, packageModule.rootPath))
    .sort((a, b) => a.rootPath.length - b.rootPath.length)

  const outermost = containing.at(0)
  const innermost = containing.at(-1)

  if (!outermost || !innermost) {
    return exportPath
  }

  // When importing from within same package, truncate the root path and denote root with '@'
  if (isUnder(destinationPath, outermost.rootPath)) {
    return `@${exportPath.slice(outermost.rootPath.length)}`
  }

  if (!innermost.moduleName) {
    throw new Error(`Module name is not set for ${innermost.rootPath}`)
  }

  return innermost.moduleName
}

const trimSlash = (rootPath: string): string =>
  rootPath.endsWith('/') ? rootPath.slice(0, -1) : rootPath

/** `path` is `rootPath` itself or a file or folder below it — never a sibling that merely shares the prefix. */
const isUnder = (path: string, rootPath: string): boolean =>
  path === rootPath || path.startsWith(`${rootPath}/`)
