/**
 * The canonical workspace-relative spelling of an artifact path or package
 * root.
 *
 * Skmtc anchors every artifact at `basePath`, and that anchor has several
 * spellings: a generator's `toExportPath` writes it as `@/` (`@/models/User.ts`),
 * config and examples write it as `./`, and std `normalize` — applied to
 * `File.path` by the drivers — strips `./` but leaves `@/` alone. Package
 * matching compares paths from all three sources, so all spellings must
 * compare equal: the leading `@/` or `./` goes, a trailing `/` goes, and the
 * workspace root itself (`@/`, `./`, `.`, ``) is the empty string.
 *
 * The `@/` stripped here is Skmtc's **workspace root**, the same prefix
 * `toResolvedArtifactPath` drops before joining onto `basePath`. It is not the
 * `@/` alias the generated TypeScript imports by — {@link toAliasPath} writes
 * that one, relative to a package root. An npm scope (`@tanstack/query`) is
 * neither and passes through untouched.
 */
export const toWorkspacePath = (path: string): string => {
  const withoutAnchor = path.replace(/^(@\/|\.\/)/, '').replace(/\/+$/, '')

  return withoutAnchor === '.' ? '' : withoutAnchor
}

/**
 * Arguments for {@link isUnderRoot}.
 */
export type IsUnderRootArgs = {
  /** Any spelling of a workspace path — see {@link toWorkspacePath} */
  path: string
  /** Any spelling of a package `rootPath` */
  rootPath: string
}

/**
 * `path` is a file or folder below `rootPath` — a root is a folder, so never a
 * sibling that merely shares the prefix (`packages/sdk` does not contain
 * `packages/sdk-legacy`), and never the root itself (no artifact is its own
 * folder). Both arguments are canonicalised first, so spelling never matters.
 *
 * The workspace root contains nothing. A bare module specifier (`zod`) is
 * indistinguishable from a forward workspace path (`types/User.ts`), so a root
 * that held everything would rewrite external imports as if they were
 * artifacts.
 */
export const isUnderRoot = ({ path, rootPath }: IsUnderRootArgs): boolean => {
  const root = toWorkspacePath(rootPath)

  return root !== '' && toWorkspacePath(path).startsWith(`${root}/`)
}
