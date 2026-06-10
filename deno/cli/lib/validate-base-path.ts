import { isAbsolute } from '@std/path/is-absolute'

/**
 * `basePath` in client.json is resolved relative to the SKMTC root
 * directory (the parent of `.skmtc/`). Absolute paths used to be
 * silently treated as relative, producing surprising output locations
 * like `<skmtc-root>/Users/.../generated`. Reject them up front with a
 * clear error so the caller knows to use a relative path instead.
 *
 * Returns the validated basePath unchanged when valid.
 */
export const validateBasePath = (basePath: string): string => {
  if (isAbsolute(basePath)) {
    throw new Error(
      [
        `Invalid basePath: "${basePath}"`,
        '',
        'basePath must be relative to the SKMTC root (the directory containing',
        '.skmtc/). Absolute paths are not supported because the generated output',
        'is always written under the SKMTC root.',
        '',
        'Example: if your repo layout is',
        '  my-repo/',
        '    .skmtc/',
        '    web/app/src/',
        '',
        "use basePath './web/app/src' (or 'web/app/src')."
      ].join('\n')
    )
  }

  if (basePath.split(/[/\\]/).some(segment => segment === '..')) {
    throw new Error(
      [
        `Invalid basePath: "${basePath}"`,
        '',
        'basePath must be a forward path with no ".." segments. It is the',
        'common on-disk anchor for generated output — set it to a directory',
        'that contains every output location (the repo root, for a monorepo).'
      ].join('\n')
    )
  }

  return basePath
}
