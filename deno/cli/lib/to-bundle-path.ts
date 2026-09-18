import { join } from '@std/path/join'
import { resolve } from '@std/path/resolve'
import { toFileUrl } from '@std/path/to-file-url'

/**
 * The `file://` URL of a project's bundle, for dynamic import. Resolved to
 * an absolute path first so the URL is well-formed on every host
 * (`file:///D:/...` on Windows, never a backslash in the URL).
 */
export const toBundlePath = (projectPath: string) => {
  return toFileUrl(resolve(projectPath, 'bundle.js')).href
}

/** The on-disk path of a project's bundle, in the host's own spelling. */
export const toBundleFsPath = (projectPath: string) => {
  return join(projectPath, 'bundle.js')
}
