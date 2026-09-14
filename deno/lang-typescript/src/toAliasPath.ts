import { isUnderRoot, toWorkspacePath } from '@skmtc/core'

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
 * `@/models/User.ts`.
 *
 * This `@` is the **package** alias in the generated code. It is not Skmtc's
 * workspace-root `@/` that `path` may arrive spelled with — that one is
 * stripped on the way in.
 *
 * @throws {Error} When `path` is not under `rootPath` — the caller matched the
 *   wrong root.
 */
export const toAliasPath = ({ path, rootPath }: ToAliasPathArgs): string => {
  if (!isUnderRoot({ path, rootPath })) {
    throw new Error(`Cannot alias '${path}': it is not under package root '${rootPath}'`)
  }

  const relative = toWorkspacePath(path).slice(toWorkspacePath(rootPath).length + 1)

  return `@/${relative}`
}
