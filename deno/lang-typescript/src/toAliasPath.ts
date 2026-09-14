import { toWorkspacePath } from '@skmtc/core'

/**
 * Arguments for {@link toAliasPath}.
 */
export type ToAliasPathArgs = {
  /** The artifact path being imported, in any spelling — see {@link toWorkspacePath} */
  path: string
  /** The root of the package both importer and target sit in, in any spelling */
  rootPath: string
}

/**
 * The intra-package import path for `path`: its location relative to the
 * package root, behind the `@/` alias the package's `tsconfig` maps to that
 * root. `packages/sdk/src/models/User.ts` under `packages/sdk/src` is
 * `@/models/User.ts`; the root itself is `@/`.
 *
 * This `@` is the **package** alias in the generated code. It is not Skmtc's
 * workspace-root `@/` that `path` may arrive spelled with — that one is
 * stripped on the way in.
 *
 * `path` must be under `rootPath`: the caller has matched it there
 * ({@link matchPackage}), so this is a plain slice.
 */
export const toAliasPath = ({ path, rootPath }: ToAliasPathArgs): string => {
  const relative = toWorkspacePath(path).slice(toWorkspacePath(rootPath).length + 1)

  return `@/${relative}`
}
