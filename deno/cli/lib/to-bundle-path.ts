import { join } from '@std/path/join'

/**
 * `file://` URL string to the project's bundle.js. Use this form for
 * dynamic `import()` of the worker bundle — `new URL(...)` / `import()`
 * consume a URL.
 *
 * Do **not** pass this to `@std/fs` `exists` / `existsSync` / file
 * reads: those treat a `file://` URL *string* as a literal,
 * non-existent path. Use {@link toBundleFsPath} for filesystem access.
 */
export const toBundlePath = (projectPath: string) => {
  return `file://${join(projectPath, 'bundle.js')}`
}

/**
 * Filesystem path to the project's bundle.js. Use this form for
 * `@std/fs` existence checks and file reads.
 *
 * The {@link toBundlePath} `file://` URL form silently false-negatives
 * against `exists` / `existsSync` (a `file://` *string* is not a path),
 * which is the root cause of the `skmtc bundle` "wasn't written" and
 * `skmtc doctor` "no bundle.js" false-failures.
 */
export const toBundleFsPath = (projectPath: string) => {
  return join(projectPath, 'bundle.js')
}
