/**
 * The canonical workspace-relative spelling of an artifact path or package
 * root.
 *
 * Skmtc anchors every artifact at `basePath`, and that anchor has several
 * spellings: a generator's `toExportPath` writes it as `@/` (`@/models/User.ts`),
 * config and examples write it as `./`, and std `normalize` — applied to
 * `File.path` by the drivers — strips `./` but leaves `@/` alone. Anything
 * that compares paths from more than one of those sources (package matching,
 * on-disk resolution) must see all spellings as equal: every leading `@/` or
 * `./` goes, a trailing `/` goes, a Windows `\` is a `/`, and the workspace
 * root itself (`@/`, `./`, `.`, ``) is the empty string. The result is a fixed
 * point: canonicalizing it again changes nothing.
 *
 * The `@/` stripped here is Skmtc's **workspace root** — the prefix
 * {@link toResolvedArtifactPath} drops before joining onto `basePath`. It is
 * not the `@/` alias a generated TypeScript import is written with; that one
 * is relative to a package root and is produced by the language package. An
 * npm scope (`@tanstack/query`) is neither and passes through untouched.
 *
 * @example
 * ```typescript
 * toWorkspacePath('@/packages/sdk/src/models/User.ts') // 'packages/sdk/src/models/User.ts'
 * toWorkspacePath('./packages/sdk/src/')               // 'packages/sdk/src'
 * toWorkspacePath('@/')                                // ''
 * toWorkspacePath('@tanstack/query')                   // '@tanstack/query'
 * ```
 */
export const toWorkspacePath = (path: string): string => {
  const withoutAnchor = path
    .replaceAll('\\', '/')
    .replace(/^(?:@\/|\.\/)+/, '')
    .replace(/\/+$/, '')

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
 * `path` is `rootPath` itself or a file or folder below it. A root is a
 * folder, so a sibling that merely shares the prefix is not under it
 * (`packages/sdk` does not contain `packages/sdk-legacy`), and a root
 * contains itself: a directory import of a root is that root's barrel. Both
 * arguments are canonicalized first, so spelling never matters.
 *
 * The workspace root is never a `rootPath` here — the {@link clientSettings}
 * schema rejects it, because a root holding every path would also hold every
 * bare module specifier (`zod` and `types/User.ts` look the same).
 *
 * @example
 * ```typescript
 * isUnderRoot({ path: '@/packages/sdk/src/User.ts', rootPath: './packages/sdk/src/' }) // true
 * isUnderRoot({ path: 'packages/sdk/src', rootPath: 'packages/sdk/src' })              // true
 * isUnderRoot({ path: 'packages/sdk-legacy/src/User.ts', rootPath: 'packages/sdk' })   // false
 * ```
 */
export const isUnderRoot = ({ path, rootPath }: IsUnderRootArgs): boolean => {
  const root = toWorkspacePath(rootPath)
  const workspacePath = toWorkspacePath(path)

  return workspacePath === root || workspacePath.startsWith(`${root}/`)
}
