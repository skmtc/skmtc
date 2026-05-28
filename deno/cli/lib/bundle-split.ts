/**
 * Split-bundle build for `skmtc deploy`. Produces three CF-Workers
 * bundles per project deploy:
 *
 *   - `<project>/server.js`           — the project bundle (generator
 *                                       composition + `createServer`);
 *                                       `@skmtc/core` and `@skmtc/server`
 *                                       are externalised so they ship
 *                                       once via the runtime keys.
 *   - `<project>/runtime/core.js`     — bundled `@skmtc/core` (no externals)
 *   - `<project>/runtime/server.js`   — bundled `@skmtc/server` with
 *                                       `@skmtc/core` externalised
 *
 * All three outputs run through `normalizeSpecifiers` so the
 * cross-bundle `@skmtc/core` import resolves to one flat
 * `skmtc-core.js` key in the runner's modules Map (rather than each
 * bundle's distinct deno-resolved JSR URL). Without normalization,
 * the modules Map would instantiate `@skmtc/core` twice and split
 * its singletons across the runtime and project bundles.
 *
 * The `serverVersion` is read from the project's
 * `deno.json#imports['@skmtc/server']` — pinned by `ensureServerDeps`
 * via `project.createServer()`. The CLI uses it to address the
 * runtime in R2 (`runtimes/{serverVersion}/{core,server}.js`) when
 * uploading to skmtc-hub, and declares it on the release row.
 */

import { join } from '@std/path/join'
import type { Project } from '@/lib/project.ts'
import { normalizeSpecifiers } from '@/lib/normalize-specifiers.ts'
import { toBundleFailureMessage } from '@/tasks/GenerateBundleTask.tsx'

const SERVER_ENTRY = 'server.ts'
const SERVER_BUNDLE = 'server.js'
const RUNTIME_DIR = 'runtime'
const RUNTIME_CORE_ENTRY = 'runtime/core.ts'
const RUNTIME_CORE_BUNDLE = 'runtime/core.js'
const RUNTIME_SERVER_ENTRY = 'runtime/server.ts'
const RUNTIME_SERVER_BUNDLE = 'runtime/server.js'

const RUNTIME_CORE_SRC = `export * from '@skmtc/core'\n`
const RUNTIME_SERVER_SRC = `export * from '@skmtc/server'\n`

export type BundleSplitResult = {
  projectBundlePath: string
  runtimeCorePath: string
  runtimeServerPath: string
  serverVersion: string
}

type BundleSplitArgs = {
  project: Project
}

/**
 * Parse a JSR pin like `jsr:@skmtc/server@0.2.10` and return the
 * version string (`0.2.10`). Throws if the pin doesn't match the
 * expected shape — local-checkout overrides (e.g. `file:` URLs)
 * have no semver we can address into R2 by.
 */
const parseJsrPin = (pin: string, packageName: string): string => {
  const expectedPrefix = `jsr:${packageName}@`
  if (!pin.startsWith(expectedPrefix)) {
    throw new Error(
      `expected ${packageName} pin of the form \`jsr:${packageName}@<version>\` ` +
        `but found \`${pin}\`. Local-checkout overrides aren't deployable; ` +
        `skmtc-hub addresses runtimes by JSR version.`
    )
  }
  return pin.slice(expectedPrefix.length)
}

const runDenoBundle = async ({
  cwd,
  entry,
  output,
  externals
}: {
  cwd: string
  entry: string
  output: string
  externals: string[]
}): Promise<void> => {
  const externalArgs = externals.flatMap((spec) => ['--external', spec])
  const command = new Deno.Command('deno', {
    args: ['bundle', '--platform', 'browser', ...externalArgs, '-o', output, entry],
    cwd,
    stdout: 'piped',
    stderr: 'piped',
    env: {
      ...Deno.env.toObject(),
      JSR_URL: Deno.env.get('JSR_URL') ?? 'https://jsr.skmtc.dev/'
    }
  })

  const logsPath = join(cwd, '.settings', 'logs.txt')
  const errorLogsPath = join(cwd, '.settings', 'error-logs.txt')

  const { success, stdout, stderr } = await command.output()

  await Deno.mkdir(join(cwd, '.settings'), { recursive: true })
  await Deno.writeFile(logsPath, stdout, { append: true, create: true })
  await Deno.writeFile(errorLogsPath, stderr, { append: true, create: true })

  if (!success) {
    throw new Error(toBundleFailureMessage({ projectPath: cwd, errorLogsPath, stderr }))
  }
}

const rewriteFile = async (path: string): Promise<void> => {
  const src = await Deno.readTextFile(path)
  const { out } = normalizeSpecifiers(src)
  await Deno.writeTextFile(path, out)
}

export const bundleSplit = async ({ project }: BundleSplitArgs): Promise<BundleSplitResult> => {
  const projectPath = project.toPath()

  await project.createServer()

  await Deno.mkdir(join(projectPath, RUNTIME_DIR), { recursive: true })
  await Deno.writeTextFile(join(projectPath, RUNTIME_CORE_ENTRY), RUNTIME_CORE_SRC)
  await Deno.writeTextFile(join(projectPath, RUNTIME_SERVER_ENTRY), RUNTIME_SERVER_SRC)

  const serverPin = project.rootDenoJson.contents.imports?.['@skmtc/server']
  if (serverPin === undefined) {
    throw new Error(
      '@skmtc/server is not pinned in deno.json. `project.createServer()` should have ' +
        'pinned it via ensureServerDeps — this is a bug.'
    )
  }
  const serverVersion = parseJsrPin(serverPin, '@skmtc/server')

  await runDenoBundle({
    cwd: projectPath,
    entry: SERVER_ENTRY,
    output: SERVER_BUNDLE,
    externals: ['jsr:@skmtc/server@*', 'jsr:@skmtc/core@*']
  })

  await runDenoBundle({
    cwd: projectPath,
    entry: RUNTIME_CORE_ENTRY,
    output: RUNTIME_CORE_BUNDLE,
    externals: []
  })

  await runDenoBundle({
    cwd: projectPath,
    entry: RUNTIME_SERVER_ENTRY,
    output: RUNTIME_SERVER_BUNDLE,
    externals: ['jsr:@skmtc/core@*']
  })

  const projectBundlePath = join(projectPath, SERVER_BUNDLE)
  const runtimeCorePath = join(projectPath, RUNTIME_CORE_BUNDLE)
  const runtimeServerPath = join(projectPath, RUNTIME_SERVER_BUNDLE)

  await rewriteFile(projectBundlePath)
  await rewriteFile(runtimeCorePath)
  await rewriteFile(runtimeServerPath)

  return { projectBundlePath, runtimeCorePath, runtimeServerPath, serverVersion }
}
