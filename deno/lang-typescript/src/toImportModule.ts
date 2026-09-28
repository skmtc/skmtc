import {
  isUnderRoot,
  hasWorkspaceAnchor,
  matchPackage,
  type ModulePackage,
  type PackageMatch
} from '@skmtc/core'
import { toAliasPath } from '@/src/toAliasPath.ts'

/**
 * Arguments for the {@link toImportModule} function.
 */
export type ToImportModuleArgs = {
  /** The path of the file that will contain the import */
  destinationPath: string
  /** The module being imported: an export path or a module specifier */
  module: string
  /** Package configuration for path resolution */
  packages: ModulePackage[] | undefined
}

/**
 * The module an import is written with, based on package configuration.
 *
 * Decides how an import of `module` is written in the file at
 * `destinationPath`:
 *
 * - **no package contains the target** → `module` as given. That covers a
 *   bare specifier (`zod`, `@tanstack/query`) and, for an importer outside
 *   every package too, the workspace-root `@/models/User.ts` a generator
 *   wrote — the consumer's `tsconfig` maps that `@/` to `basePath`. An
 *   importer *inside* a package cannot write that: its `@/` is the package
 *   root, so the target's folder must be a package root as well.
 * - **importer and target in the same package** → `@/` relative to the
 *   package root ({@link toAliasPath}).
 * - **importer outside the package** → the package's `moduleName`.
 *
 * Package roots may nest. A nested root is a **subpath export** of the
 * package that contains it: files under it share the outer package's `@`
 * alias, and a file outside the package imports them by the nested root's
 * `moduleName` — `@company/sdk/models` rather than `@company/sdk`. So the
 * outermost root containing the target decides whether an import is
 * intra-package, and the innermost decides what an outside importer writes
 * ({@link matchPackage}). The order of `packages` does not matter, and neither
 * does path spelling: `@/packages/sdk`, `./packages/sdk/` and `packages/sdk`
 * are one root.
 *
 * @throws {Error} When the target sits in a package the importer is outside
 *   of and that package (for a subpath, the nested root) has no `moduleName`;
 *   or when the importer is in a package and the target is a workspace-root
 *   (`@/`, `./`) path under no package
 *
 * @example Cross-package import
 * ```typescript
 * const normalized = toImportModule({
 *   destinationPath: './packages/client/src/api.ts',
 *   module: './packages/types/models/User.ts',
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
 * const normalized = toImportModule({
 *   destinationPath: './packages/types/src/index.ts',
 *   module: './packages/types/models/User.ts',
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
 * toImportModule({
 *   destinationPath: './packages/sdk/src/client/getUser.ts',
 *   module: './packages/sdk/src/models/User.ts',
 *   packages
 * }); // '@/models/User.ts' — inside the package, one alias
 * toImportModule({
 *   destinationPath: './apps/api/src/routes/users.ts',
 *   module: './packages/sdk/src/models/User.ts',
 *   packages
 * }); // '@company/sdk/models' — outside it, the subpath
 * ```
 *
 * @example No package match (returns original path)
 * ```typescript
 * const normalized = toImportModule({
 *   destinationPath: './src/index.ts',
 *   module: './src/utils.ts',
 *   packages: []
 * });
 * console.log(normalized); // './src/utils.ts'
 * ```
 */
export const toImportModule = ({
  destinationPath,
  module,
  packages
}: ToImportModuleArgs): string => {
  // A module not spelled from the workspace root is a specifier (`zod`,
  // `@tanstack/query`, `types/y.ts`) and is written as it is; only an export
  // path is re-keyed through the package roots. The same predicate decides
  // in `register`, so a string is never a specifier there and a path here.
  if (!hasWorkspaceAnchor(module)) {
    return module
  }

  const match = matchPackage({ path: module, packages })

  if (!match) {
    const importer = matchPackage({ path: destinationPath, packages })

    if (importer) {
      throw new Error(
        `'${destinationPath}' is in package root '${importer.outermost.rootPath}' but imports ` +
          `'${module}', which is under no package root. A package file resolves '@/' from ` +
          `its own root, so add a package root containing '${module}' to settings.packages.`
      )
    }

    return module
  }

  if (isUnderRoot({ path: destinationPath, rootPath: match.outermost.rootPath })) {
    return toAliasPath({ path: module, rootPath: match.outermost.rootPath })
  }

  if (!match.innermost.moduleName) {
    throw new Error(toMissingModuleNameMessage({ match, destinationPath, module }))
  }

  return match.innermost.moduleName
}

type ToMissingModuleNameMessageArgs = {
  match: PackageMatch
  destinationPath: string
  module: string
}

const toMissingModuleNameMessage = ({
  match: { outermost, innermost },
  destinationPath,
  module
}: ToMissingModuleNameMessageArgs): string => {
  const message =
    `Package root '${innermost.rootPath}' has no moduleName, but '${destinationPath}' imports ` +
    `'${module}' from outside it. Set moduleName on that root in settings.packages`

  if (outermost === innermost || !outermost.moduleName) {
    return `${message}.`
  }

  const subpath = innermost.rootPath.slice(outermost.rootPath.length + 1)

  return `${message} — a nested root is a subpath export and needs its own name, like '${outermost.moduleName}/${subpath}'.`
}
