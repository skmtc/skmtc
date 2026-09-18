import { normalize } from '@std/path/posix/normalize'
import { isAbsolute as isPosixAbsolute } from '@std/path/posix/is-absolute'
import { isAbsolute as isWindowsAbsolute } from '@std/path/windows/is-absolute'
import { toWorkspacePath } from '@/helpers/toWorkspacePath.ts'

/**
 * Options for {@link normalizeExportPath} and {@link toExportPathBody}.
 */
export type NormalizeExportPathOptions = {
  /** Names the generator in the error when the path is rejected. */
  generatorId?: string
}

/**
 * Whether a path contains a `..` parent-reference segment. `..` is a parent
 * reference only as a whole segment — a directory name that merely contains
 * dots is not flagged.
 */
export const hasParentSegment = (path: string): boolean =>
  path.split(/[/\\]/).some(segment => segment === '..')

/**
 * Whether a path is absolute on either host: a POSIX root, a Windows drive
 * (`C:\`, `C:/`) or a UNC share. Checked on every host, so a client.json
 * written on Windows is rejected the same way on Linux.
 */
export const isAbsolutePath = (path: string): boolean =>
  isPosixAbsolute(path.replaceAll('\\', '/')) || isWindowsAbsolute(path)

/**
 * A Windows drive path (`C:\`, `C:/`) or a UNC path (`\\server\share`):
 * the two absolute forms that can never be relative to `basePath`. A bare
 * leading `/` is not one — it is an anchor spelling of the workspace root.
 */
const isDriveOrUncPath = (path: string): boolean =>
  /^[A-Za-z]:[\\/]/.test(path) || path.startsWith('\\\\')

/**
 * Whether `path` is spelled from the workspace root — `@/`, `./`, a bare
 * leading `/`, or their Windows forms. An artifact path, never a bare
 * module specifier such as `zod` or `@tanstack/query`.
 */
export const isWorkspaceSpelled = (path: string): boolean => /^(@[\\/]|\.[\\/]|[\\/])/.test(path)

/**
 * Whether `path` can be an export path: not a Windows drive or UNC path,
 * no `..` segment, and naming a file rather than `basePath` itself. The
 * non-throwing form of {@link normalizeExportPath}'s checks, for schema
 * validation and for comparing a module specifier against a file path.
 */
export const isExportPath = (path: string): boolean =>
  !isDriveOrUncPath(path) && !hasParentSegment(path) && toBody(path) !== ''

/**
 * The export path relative to `basePath`, canonical and with no anchor:
 * what {@link normalizeExportPath} writes after `@/`, and what
 * {@link toResolvedArtifactPath} joins onto `basePath`.
 *
 * Throws when the path cannot name a file below `basePath`: a Windows
 * drive or UNC path, a `..` segment (checked as a whole segment before
 * normalization, so it is never resolved), or a path naming `basePath`
 * itself (`@/`, `@`, `./`, `.`, `/`, ``).
 */
export const toExportPathBody = (
  path: string,
  { generatorId }: NormalizeExportPathOptions = {}
): string => {
  const reject = (reason: string): never => {
    const source = generatorId ? ` returned by generator '${generatorId}'` : ''

    throw new Error(`Export path '${path}'${source} ${reason}`)
  }

  if (isDriveOrUncPath(path)) {
    return reject('is a Windows drive or UNC path; an export path is relative to basePath')
  }

  if (hasParentSegment(path)) {
    return reject('contains a ".." segment; an export path is a forward path below basePath')
  }

  const body = toBody(path)

  if (body === '') {
    return reject('names basePath itself; an export path names a file below it')
  }

  return body
}

/**
 * The one spelling of an export path: `@/` followed by a POSIX path
 * relative to `basePath`.
 *
 * An export path is a logical path inside the workspace, never a
 * filesystem path, so it reads the same on every host. A generator may
 * return it as `@/types/User.ts`, `./types/User.ts`, `/types/User.ts`,
 * `types/User.ts`, or with Windows separators; the engine stores this form
 * and nothing else, so file-map keys, import modules and the ejected lookup
 * always agree. The result is a fixed point.
 *
 * Throws in the cases {@link toExportPathBody} throws.
 *
 * @example
 * ```typescript
 * normalizeExportPath('@\\types\\User.ts') // '@/types/User.ts'
 * normalizeExportPath('./types/User.ts')   // '@/types/User.ts'
 * normalizeExportPath('../User.ts')        // throws
 * ```
 */
export const normalizeExportPath = (
  path: string,
  options: NormalizeExportPathOptions = {}
): string => `@/${toExportPathBody(path, options)}`

/**
 * Separator swap, then every anchor spelling goes (`@/`, `./`, a leading
 * `/` — {@link toWorkspacePath}), then POSIX normalize of what is left so
 * `@//x` and `@/./x` collapse. The anchor goes first so normalize can
 * never fold it into a name (`@/.` is the root, not a file called `@`).
 * The root in any spelling is the empty string.
 */
const toBody = (path: string): string => {
  const stripped = toWorkspacePath(path.replaceAll('\\', '/'))

  if (stripped === '') {
    return ''
  }

  const normalized = normalize(stripped)

  return normalized === '.' ? '' : normalized
}
