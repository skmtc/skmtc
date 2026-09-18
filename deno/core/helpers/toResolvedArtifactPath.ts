/**
 * Resolves an artifact's destination path onto `basePath`.
 *
 * `destinationPath` is an export path in any spelling
 * ({@link normalizeExportPath}) — `@/models/User.ts` as a generator wrote
 * it, `./models/User.ts`, or with Windows separators — and is always
 * joined onto `basePath` with forward slashes, so the artifact key reads
 * the same on every host. A `..` segment or an absolute path is refused:
 * every artifact lands below `basePath`, whoever writes it.
 *
 * @module toResolvedArtifactPath
 */

import { join } from '@std/path/posix/join'
import { normalizeExportPath } from '@/helpers/normalizeExportPath.ts'
import { toWorkspacePath } from '@/helpers/toWorkspacePath.ts'

/**
 * Arguments for resolving artifact file paths.
 *
 * Defines the input parameters needed to resolve a destination path
 * relative to an optional base directory.
 */
type ToResolvedArtifactPathArgs = {
  /** The base directory path for resolving relative paths */
  basePath: string | undefined
  /** The destination path for the artifact file */
  destinationPath: string
}

/**
 * Joins `destinationPath` (canonicalized) onto `basePath`, or onto the
 * workspace root when `basePath` is undefined. Throws when
 * `destinationPath` cannot name a file below `basePath`.
 *
 * @example
 * ```typescript
 * toResolvedArtifactPath({ basePath: './output', destinationPath: '@/api/models.ts' })
 * // 'output/api/models.ts'
 * toResolvedArtifactPath({ basePath: undefined, destinationPath: 'types.ts' })
 * // 'types.ts'
 * ```
 */
export const toResolvedArtifactPath = ({
  basePath,
  destinationPath
}: ToResolvedArtifactPathArgs): string => {
  return join(
    toWorkspacePath(basePath ?? ''),
    toWorkspacePath(normalizeExportPath(destinationPath))
  )
}
