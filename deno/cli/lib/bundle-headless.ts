/**
 * Headless `bundle` path — builds the project's worker + bundle.js
 * artifact without any Ink rendering. Strict mode invokes this
 * directly.
 *
 * For **remote-only** projects (no local-cloned or local-authored
 * generators), `deno bundle` produces a `worker.ts` and a `deno.lock`
 * but no `bundle.js` — the published JSR bundle is used at
 * `generate` time instead. Pre-fix this was silent (friction #8);
 * now the result returns `noop: 'remote-only'` so the caller can
 * see why no `bundle.js` was emitted.
 */

import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { createBundle } from '@/tasks/GenerateBundleTask.tsx'
import { exists } from '@std/fs/exists'
import { parseModuleName } from '@skmtc/core/parseModuleName'
import { toBundleFsPath } from '@/lib/to-bundle-path.ts'

type BundleHeadlessArgs = {
  skmtcRoot: SkmtcRoot
  projectName: string
}

export type BundleHeadlessResult =
  | {
      kind: 'bundled'
      projectName: string
      bundlePath: string
    }
  | {
      kind: 'noop'
      projectName: string
      reason: 'remote-only'
      detail: string
    }

export const bundleHeadless = async ({
  skmtcRoot,
  projectName
}: BundleHeadlessArgs): Promise<BundleHeadlessResult> => {
  const project = skmtcRoot.findProject(projectName)
  const imports = project.rootDenoJson.contents.imports ?? {}

  // A generator entry is "local" iff its value isn't a `jsr:` specifier.
  // Local clones / created generators use relative paths like
  // `../gen-x/mod.ts`. Remote installs always go through `jsr:`.
  const hasLocalGenerator = Object.entries(imports).some(([id, value]) => {
    const isGenerator = parseModuleName(id).packageName.startsWith('gen-')
    if (!isGenerator) return false
    return typeof value === 'string' && !value.startsWith('jsr:')
  })

  if (!hasLocalGenerator) {
    return {
      kind: 'noop',
      projectName,
      reason: 'remote-only',
      detail:
        'Project has only remote (installed) generators; the published JSR ' +
        '`bundle.js` will be used by `skmtc generate`. No local bundle.js to build.'
    }
  }

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
    kind: 'bundled',
    projectName,
    bundlePath
  }
}
