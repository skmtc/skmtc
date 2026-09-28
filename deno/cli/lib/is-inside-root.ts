import { SEPARATOR } from '@std/path/constants'
import { relative } from '@std/path/relative'
import { resolve } from '@std/path/resolve'
import { isAbsolute } from '@std/path/is-absolute'

/**
 * Whether `path` is `root` itself or a file or folder below it, on disk.
 * Both are resolved first, and the answer comes from `relative`, so a
 * sibling that merely shares the root's prefix (`app-legacy` next to
 * `app`) is outside, a `..` that climbs out is outside, and a first
 * segment that merely begins with two dots (`..cache`) is inside. The
 * single containment check for every write and delete the CLI performs.
 */
export const isInsideRoot = (root: string, path: string): boolean => {
  const relativePath = relative(resolve(root), resolve(path))

  return (
    relativePath === '' ||
    (relativePath !== '..' &&
      !relativePath.startsWith(`..${SEPARATOR}`) &&
      !isAbsolute(relativePath))
  )
}
