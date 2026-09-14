/**
 * Resolves an artifact's destination path onto `basePath`.
 *
 * `destinationPath` is a workspace path in any spelling
 * ({@link toWorkspacePath}) — `@/models/User.ts` as a generator wrote it,
 * or `./models/User.ts` — and is always joined onto `basePath`; there is no
 * absolute-path escape.
 *
 * @module toResolvedArtifactPath
 */

import { join } from '@std/path/join'
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
 * Joins `destinationPath` (canonicalised) onto `basePath`, or onto `./` when
 * `basePath` is undefined.
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
  return join(basePath ?? './', toWorkspacePath(destinationPath))
}
