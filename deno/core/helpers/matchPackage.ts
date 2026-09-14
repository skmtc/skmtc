import type { ModulePackage } from '@/types/Settings.ts'
import { isUnderRoot, toWorkspacePath } from '@/helpers/toWorkspacePath.ts'

/**
 * Arguments for {@link matchPackage}.
 */
export type MatchPackageArgs = {
  /** The artifact path to locate, in any spelling — see {@link toWorkspacePath} */
  path: string
  /** `settings.packages`; roots may nest and may be listed in any order */
  packages: ModulePackage[] | undefined
}

/**
 * The packages a path belongs to. Both carry a canonical `rootPath`.
 *
 * Package roots may nest — a nested root is a subpath export of the package
 * around it — so one path can sit under several roots. They nest as a chain
 * (each is an ancestor of the next), and the two ends of the chain answer the
 * two questions a language package asks.
 */
export type PackageMatch = {
  /**
   * The widest root containing the path — the package. Decides whether an
   * import is intra-package: every file in the package shares one alias,
   * rooted here.
   */
  outermost: ModulePackage
  /**
   * The narrowest root containing the path — the subpath. Its `moduleName` is
   * what a file outside the package imports (`@acme/sdk/models`); its folders
   * are what a Kotlin `package` directive starts after.
   */
  innermost: ModulePackage
}

/**
 * Finds the package roots containing `path`, or `undefined` when no root does.
 *
 * Roots are compared as folders in canonical spelling, so `./packages/sdk/`,
 * `@/packages/sdk` and `packages/sdk` are one root, and the order of
 * `packages` never matters. `packages` is expected to have passed the
 * {@link clientSettings} schema, which rejects duplicate roots and the
 * workspace root.
 *
 * @example
 * ```typescript
 * const packages = [
 *   { rootPath: 'packages/sdk/src', moduleName: '@acme/sdk' },
 *   { rootPath: 'packages/sdk/src/models', moduleName: '@acme/sdk/models' }
 * ]
 * matchPackage({ path: '@/packages/sdk/src/models/User.ts', packages })
 * // { outermost: { rootPath: 'packages/sdk/src', … }, innermost: { rootPath: 'packages/sdk/src/models', … } }
 * matchPackage({ path: 'zod', packages }) // undefined
 * ```
 */
export const matchPackage = ({
  path,
  packages = []
}: MatchPackageArgs): PackageMatch | undefined => {
  // Every root here contains the same path, so the roots nest: each is a
  // prefix of the next. Ordering by length is therefore ordering by depth,
  // outermost first.
  const containing = packages
    .map(({ rootPath, moduleName }) => ({ rootPath: toWorkspacePath(rootPath), moduleName }))
    .filter(modulePackage => isUnderRoot({ path, rootPath: modulePackage.rootPath }))
    .sort((a, b) => a.rootPath.length - b.rootPath.length)

  if (containing.length === 0) {
    return undefined
  }

  return { outermost: containing[0], innermost: containing[containing.length - 1] }
}
