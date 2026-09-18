import { normalizeExportPath } from '@/helpers/normalizeExportPath.ts'

/**
 * Whether two export paths name different files, so a symbol from one
 * must be imported into the other.
 *
 * Both are canonicalized with {@link normalizeExportPath}, so every
 * spelling of one file compares equal: `@/`, `./`, the bare form, and
 * Windows separators. Throws, as that does, for a path that cannot be an
 * export path (a `..` segment, a Windows drive path).
 *
 * @example
 * ```typescript
 * isImported('@/src/user.ts', './src/user.ts')    // false — one file
 * isImported('src\\user.ts', 'src/user.ts')       // false — one file
 * isImported('@/src/user.ts', '@/src/product.ts') // true
 * ```
 */
export const isImported = (pathOne: string, pathTwo: string): boolean => {
  return normalizeExportPath(pathOne) !== normalizeExportPath(pathTwo)
}
