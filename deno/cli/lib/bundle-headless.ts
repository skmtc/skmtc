/**
 * Headless `bundle` path — builds the project's worker + bundle.js
 * artifact without any Ink rendering. Strict mode invokes this
 * directly.
 *
 * Every project gets a local `bundle.js`, including **remote-only**
 * projects (only `jsr:`-installed generators): `generate` always
 * dynamic-imports the project-local `bundle.js`, and `deno bundle`
 * resolves `jsr:` specifiers through the project's import map, so
 * the build works identically for installed and cloned generators.
 * (An earlier version no-op'd here on the assumption that a
 * published JSR bundle would be used at generate time — no such
 * path exists; the no-op left pure-install projects unable to
 * generate.)
 */

import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { createBundle } from '@/lib/create-bundle.ts'
import { exists } from '@std/fs/exists'
import { toBundleFsPath } from '@/lib/to-bundle-path.ts'

type BundleHeadlessArgs = {
  skmtcRoot: SkmtcRoot
  projectName: string
}

export type BundleHeadlessResult = {
  type: 'bundled'
  projectName: string
  bundlePath: string
}

export const bundleHeadless = async ({
  skmtcRoot,
  projectName
}: BundleHeadlessArgs): Promise<BundleHeadlessResult> => {
  const project = skmtcRoot.findProject(projectName)

  const bundlePath = await createBundle({ project })

  // Belt-and-braces: confirm the file actually landed on disk before
  // declaring success. `createBundle` already throws on failure, but
  // a separate readback closes the silent-success class of bug.
  //
  // The check must use the filesystem-path form: `createBundle`
  // returns a `file://` URL string (for dynamic `import()`), and
  // `@std/fs` `exists` treats a `file://` string as a literal,
  // non-existent path — passing it here false-negatives on every
  // successful bundle.
  if (!(await exists(toBundleFsPath(project.toPath()), { isFile: true }))) {
    throw new Error(
      `bundle.js was expected at ${bundlePath} but wasn't written`
    )
  }

  return {
    type: 'bundled',
    projectName,
    bundlePath
  }
}
