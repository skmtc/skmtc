import type { ModulePackage } from '@skmtc/core'
import { isUnderRoot, toWorkspacePath } from './toWorkspacePath.ts'

/**
 * Arguments for {@link matchPackage}.
 */
export type MatchPackageArgs = {
  /** The artifact path to locate, in any spelling — see {@link toWorkspacePath} */
  path: string
  /** The `packages` from settings; roots may nest and may be listed in any order */
  packages: ModulePackage[] | undefined
}

/**
 * The packages a path belongs to. Both carry a canonical `rootPath`.
 *
 * Package roots may nest — a nested root is a subpath export of the package
 * around it — so one path can sit under several roots. They nest as a chain
 * (each is an ancestor of the next), and the two ends of the chain answer the
 * two questions an import raises.
 */
export type PackageMatch = {
  /**
   * The widest root containing the path. Decides whether an import is
   * intra-package: every file in the package shares one `@`, rooted here.
   */
  outermost: ModulePackage
  /**
   * The narrowest root containing the path. Its `moduleName` is what a file
   * outside the package writes — the subpath, `@acme/sdk/models`.
   */
  innermost: ModulePackage
}

/**
 * Finds the package roots containing `path`, or `undefined` when no root does.
 *
 * Roots are compared as folders in canonical spelling, so `./packages/sdk/`,
 * `@/packages/sdk` and `packages/sdk` are one root, and the order of
 * `packages` never matters.
 *
 * @throws {Error} When the same root is configured twice with different module
 *   names — there is no order-independent way to pick one.
 */
export const matchPackage = ({
  path,
  packages = []
}: MatchPackageArgs): PackageMatch | undefined => {
  // Every root here contains the same path, so the roots nest: each is a
  // prefix of the next. Ordering by length is therefore ordering by depth,
  // outermost first.
  const containing = toCanonicalPackages(packages)
    .filter(modulePackage => isUnderRoot({ path, rootPath: modulePackage.rootPath }))
    .sort((a, b) => a.rootPath.length - b.rootPath.length)

  if (containing.length === 0) {
    return undefined
  }

  return { outermost: containing[0], innermost: containing[containing.length - 1] }
}

/**
 * One entry per root, in canonical spelling. Two spellings of one root merge;
 * a `moduleName` on either side survives the merge.
 */
const toCanonicalPackages = (packages: ModulePackage[]): ModulePackage[] => {
  const byRoot = new Map<string, ModulePackage>()

  for (const { rootPath, moduleName } of packages) {
    const canonicalRoot = toWorkspacePath(rootPath)
    const existing = byRoot.get(canonicalRoot)

    if (existing?.moduleName && moduleName && existing.moduleName !== moduleName) {
      throw new Error(
        `Package root '${canonicalRoot}' is configured twice with different module names: ` +
          `'${existing.moduleName}' and '${moduleName}'`
      )
    }

    byRoot.set(canonicalRoot, {
      rootPath: canonicalRoot,
      moduleName: existing?.moduleName ?? moduleName
    })
  }

  return [...byRoot.values()]
}
