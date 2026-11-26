import { normalizeWorkspacePath } from '@/helpers/normalizeWorkspacePath.ts'

/**
 * The value at `path` in a map keyed by normalized workspace paths, such as
 * the engine's files. A path that is a key is normalized already, so only a
 * path that is no key is normalized, and looked up again.
 *
 * Throws, as {@link normalizeWorkspacePath} does, for a path that is no key
 * and cannot name a file below `basePath`.
 */
export const getByWorkspacePath = <Value>(
  map: ReadonlyMap<string, Value>,
  path: string
): Value | undefined => map.get(path) ?? map.get(normalizeWorkspacePath(path))
