import { join } from '@std/path/join'
import { toFileUrl } from '@std/path/to-file-url'
import { rootDenoJson } from '@skmtc/core/DenoJson'
import type { BundleProject } from '@/lib/bundle-project.ts'
import { toBundleFsPath, toBundlePath } from '@/lib/to-bundle-path.ts'
import { toDependencyAgeArgs } from '@/lib/dependency-age.ts'
import { toGraphCheck, toGraphRefusal } from '@/lib/duplicate-packages.ts'
import { parseOrExplain } from '@/lib/parse-or-explain.ts'
import { toGeneratorIds } from '@/lib/root-deno-json.ts'
import { toWorker } from '@/lib/to-worker.ts'
import { toWorkerModule } from '@/lib/stack-core.ts'
import {
  type BundleVersions,
  isBundleCurrent,
  removeBundleRecord,
  toBundleInputs,
  toCurrentVersions,
  toFileDigest,
  toGraphFiles,
  writeBundleRecord
} from '@/lib/bundle-inputs.ts'

/**
 * Build a project's bundle from its generated `worker.ts`.
 *
 * This is pure orchestration — `Deno.Command` + fs — with **no JSX, ink,
 * or react**. It lives in a plain `.ts` (not the `GenerateBundleTask.tsx`
 * component that wraps it) so the headless paths (`bundle`/`generate`/
 * `dev` in `--json` / `--no-input`) can call it WITHOUT dragging the
 * ink@6 → react@19 renderer graph into their module graph. That graph
 * (~76MB, 1.6MB of react-reconciler alone) trips a Deno 2.7.5–2.8.1
 * module-evaluation scheduler regression that hangs evaluation even when
 * no TUI is ever rendered. Keep this file ink-free; verify with
 * `deno info lib/bundle-headless.ts | grep -i 'npm:/ink'` → nothing.
 */

type CreateBundleArgs = {
  project: BundleProject
  /**
   * Skip the build when `bundle.js` was built from the inputs the project
   * has now (see `@/lib/bundle-inputs.ts`). For `generate` and the first
   * run of `dev`; `skmtc bundle` always builds.
   */
  reuse?: boolean
  versions?: BundleVersions
}

/**
 * Builds `bundle.js` in the project directory, for the command that runs
 * it next. `deno bundle` writes to a temporary file under `.settings/`,
 * which is renamed over `bundle.js` only when the build succeeds, so a
 * command running at the same time never loads a missing or half-written
 * bundle. A build that succeeds and passes the graph check writes
 * `.settings/bundle-inputs.json`, the record `reuse` compares with.
 * Returns the URL of the bundle to run.
 */
export const createBundle = async ({
  project,
  reuse = false,
  versions = toCurrentVersions()
}: CreateBundleArgs): Promise<string> => {
  const projectPath = project.toPath()
  const settingsPath = join(projectPath, '.settings')

  await project.createWorker()

  if (reuse && (await isBundleCurrent({ projectPath, versions }))) {
    return toBundlePath(projectPath)
  }

  const graphCheck = await toGraphCheck({ projectName: project.name, projectPath })
  if (graphCheck.type === 'refused') {
    throw new Error(graphCheck.message)
  }
  const graphFiles = toGraphFiles(projectPath, graphCheck.localFiles)
  const inputs = await toBundleInputs({ projectPath, versions, graphFiles })

  const temporaryBundleName = join('.settings', `bundle-${crypto.randomUUID()}.js`)
  const temporaryBundlePath = join(projectPath, temporaryBundleName)

  // Without the age flag, `deno bundle` on Deno ≥ 2.9 rejects a freshly
  // released stack — the project's pins name `@skmtc/*` versions that
  // publish on every merge, so they are younger than the default cutoff.
  // Same rationale as the installer's flag on `deno install`
  // (skmtc-hub/apps/install); see `@/lib/dependency-age.ts`.
  const { success, stdout, stderr } = await new Deno.Command('deno', {
    args: ['bundle', ...toDependencyAgeArgs(), '-o', temporaryBundleName, 'worker.ts'],
    cwd: projectPath,
    stdout: 'piped',
    stderr: 'piped'
  }).output()

  // Each build replaces the logs of the one before, so they stay the size
  // of one build.
  const errorLogsPath = join(settingsPath, 'error-logs.txt')
  await replaceFile(join(settingsPath, 'logs.txt'), stdout)
  await replaceFile(errorLogsPath, stderr)

  if (!success) {
    await Deno.remove(temporaryBundlePath).catch(() => undefined)
    throw new Error(toBundleFailureMessage({ projectPath, errorLogsPath, stderr }))
  }

  // The record holds the digest of the bundle it describes, so a record
  // that ends up beside another bundle.js (a git checkout, a concurrent
  // build) never lets that bundle run. The inputs are read again after
  // the build and kept only when nothing changed while it ran — except a
  // deno.lock the build itself wrote, which happens only when the inputs
  // before it had no lock or a pin the lock did not hold.
  // A bundle that can't be read for its digest gets no record.
  const bundleDigest = await toFileDigest(temporaryBundlePath).catch(() => undefined)
  await removeBundleRecord(projectPath)
  await Deno.rename(temporaryBundlePath, toBundleFsPath(projectPath))
  const builtInputs = await toBundleInputs({ projectPath, versions, graphFiles })
  const unchangedWhileBuilding =
    inputs.type === 'fingerprinted'
      ? builtInputs.type === 'fingerprinted' && builtInputs.fingerprint === inputs.fingerprint
      : builtInputs.sourceDigest !== undefined && builtInputs.sourceDigest === inputs.sourceDigest
  if (
    builtInputs.type === 'fingerprinted' &&
    unchangedWhileBuilding &&
    bundleDigest !== undefined
  ) {
    await writeBundleRecord(projectPath, {
      fingerprint: builtInputs.fingerprint,
      ...versions,
      bundleDigest,
      graphFiles
    })
  }

  return toBundlePath(projectPath)
}

const replaceFile = async (path: string, contents: Uint8Array): Promise<void> => {
  // Assign the outer binding (no `const`) so `finally` closes the handle.
  let file: Deno.FsFile | undefined
  try {
    file = await Deno.open(path, { create: true, write: true, truncate: true })
    await file.write(contents)
  } finally {
    file?.close()
  }
}

/** A bundle in a temporary directory; disposing it deletes the directory. */
export type ReadOnlyBundle = AsyncDisposable & {
  /** URL of the bundle to run. */
  bundlePath: string
}

/** Bound on each step of a read-only build — a cold cache with no network would otherwise hang it. */
const READ_ONLY_BUILD_TIMEOUT_MS = 20_000

type CreateReadOnlyBundleArgs = {
  projectName: string
  projectPath: string
  timeoutMs?: number
}

/**
 * Builds a project's bundle without writing to the project: `worker.ts`
 * and `bundle.js` go to a temporary directory, the project's `deno.json`
 * is used as it is, and `--frozen` keeps `deno.lock` unchanged. Throws
 * when the project can't be built that way — a missing `@skmtc/worker` or
 * `@skmtc/core` pin, or pins that changed since the last build — which
 * `skmtc generate` fixes. For the commands that must not write
 * (`status`, `clean`, `describe`).
 */
export const createReadOnlyBundle = async ({
  projectName,
  projectPath,
  timeoutMs = READ_ONLY_BUILD_TIMEOUT_MS
}: CreateReadOnlyBundleArgs): Promise<ReadOnlyBundle> => {
  const denoJsonPath = join(projectPath, 'deno.json')
  const { imports } = parseOrExplain(
    rootDenoJson,
    JSON.parse(await Deno.readTextFile(denoJsonPath)),
    `deno.json at ${denoJsonPath}`
  )
  const workerModule = toWorkerModule(imports)
  const neededPins =
    workerModule === '@skmtc/worker' ? ['@skmtc/worker', '@skmtc/core'] : ['@skmtc/core']
  const missingPins = neededPins.filter(name => imports?.[name] === undefined)
  if (missingPins.length > 0) {
    throw new Error(
      `Project "${projectName}" does not pin ${missingPins.join(' or ')}. ` +
        `Run \`skmtc generate ${projectName}\` or \`skmtc bundle ${projectName}\`, which add the pins.`
    )
  }

  const directory = await Deno.makeTempDir({ prefix: 'skmtc-bundle-' })
  const bundle: ReadOnlyBundle = {
    bundlePath: toFileUrl(join(directory, 'bundle.js')).href,
    [Symbol.asyncDispose]: () => Deno.remove(directory, { recursive: true })
  }

  try {
    const workerPath = join(directory, 'worker.ts')
    await Deno.writeTextFile(
      workerPath,
      toWorker({ generatorIds: toGeneratorIds(imports), workerModule })
    )

    const refusal = await toGraphRefusal({
      projectName,
      projectPath,
      options: { frozen: true, timeoutMs, entryPath: workerPath }
    })
    if (refusal !== undefined) {
      throw new Error(refusal)
    }

    const signal = AbortSignal.timeout(timeoutMs)
    const { success, stderr } = await new Deno.Command('deno', {
      args: [
        'bundle',
        '--frozen',
        '--config',
        denoJsonPath,
        ...toDependencyAgeArgs(),
        '-o',
        'bundle.js',
        'worker.ts'
      ],
      cwd: directory,
      stdout: 'null',
      stderr: 'piped',
      signal
    }).output()

    if (signal.aborted) {
      throw new Error(`\`deno bundle\` took longer than ${timeoutMs}ms.`)
    }
    if (!success) {
      throw new Error(toBundleFailureMessage({ projectPath, stderr }))
    }

    return bundle
  } catch (error) {
    await bundle[Symbol.asyncDispose]()
    throw error
  }
}

type ToBundleFailureMessageArgs = {
  projectPath: string
  /** Where the full output was written, when it was. */
  errorLogsPath?: string
  stderr: Uint8Array
}

/**
 * Build the error message for a failed `deno bundle`.
 *
 * The captured subprocess stderr is the only diagnosable cause of a
 * bundle failure — wrong Deno version, missing import-map entry, bad
 * specifier. Without it every distinct failure collapses to an opaque
 * "Failed to create bundle" and the real error is reachable only by
 * knowing to read `.settings/error-logs.txt` out of band.
 */
export const toBundleFailureMessage = ({
  projectPath,
  errorLogsPath,
  stderr
}: ToBundleFailureMessageArgs): string => {
  const errorOutput = new TextDecoder().decode(stderr).trim()

  return [
    `Failed to create bundle — \`deno bundle\` failed in ${projectPath}.`,
    errorOutput || '(no stderr captured)',
    ...(errorLogsPath === undefined ? [] : [`Full output: ${errorLogsPath}`])
  ].join('\n\n')
}
