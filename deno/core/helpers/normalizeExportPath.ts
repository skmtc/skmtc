import { normalize } from '@std/path/posix/normalize'
import { isAbsolute as isPosixAbsolute } from '@std/path/posix/is-absolute'
import { isAbsolute as isWindowsAbsolute } from '@std/path/windows/is-absolute'
import { toWorkspacePath } from '@/helpers/toWorkspacePath.ts'

/**
 * Options for {@link normalizeExportPath}.
 */
export type NormalizeExportPathOptions = {
  /** Names the generator in the error when the path is rejected. */
  generatorId?: string
}

/**
 * The one spelling of an export path: `@/` followed by a POSIX path
 * relative to `basePath`.
 *
 * An export path is a logical path inside the workspace, never a
 * filesystem path, so it reads the same on every host. A generator may
 * return it as `@/types/User.ts`, `./types/User.ts`, `types/User.ts`, or
 * with Windows separators; the engine stores this form and nothing else,
 * so file-map keys, import modules and the ejected lookup always agree.
 * The result is a fixed point.
 *
 * Throws when the path cannot name a file below `basePath`: a `..`
 * segment (checked as a whole segment, before normalization, so it is
 * never resolved), an absolute path on either host, or a path naming
 * `basePath` itself (`@/`, `./`, `.`, ``).
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
  { generatorId }: NormalizeExportPathOptions = {}
): string => {
  const forward = path.replaceAll('\\', '/')

  const reject = (reason: string): never => {
    const source = generatorId ? ` returned by generator '${generatorId}'` : ''

    throw new Error(`Export path '${path}'${source} ${reason}`)
  }

  if (isPosixAbsolute(forward) || isWindowsAbsolute(path)) {
    return reject('is absolute; an export path is relative to basePath')
  }

  if (forward.split('/').some(segment => segment === '..')) {
    return reject('contains a ".." segment; an export path is a forward path below basePath')
  }

  const normalized = normalize(toWorkspacePath(forward))

  if (normalized === '' || normalized === '.') {
    return reject('names basePath itself; an export path names a file below it')
  }

  return `@/${normalized}`
}

/**
 * Whether `path` is spelled from the workspace root (`@/`, `./`, or their
 * Windows forms) — an artifact path, never a bare module specifier such as
 * `zod` or `@tanstack/query`.
 */
export const isWorkspaceSpelled = (path: string): boolean => /^(@|\.)[\\/]/.test(path)
