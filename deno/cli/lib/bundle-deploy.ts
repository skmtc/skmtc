/**
 * Bundle build for `skmtc deploy`. Produces ONE self-contained CF-Workers
 * bundle per project:
 *
 *   - `<project>/server.js` — the generator composition + `createServer` +
 *     `@skmtc/server` + `@skmtc/core` all inlined, nothing external (~1.2 MB).
 *
 * The runner loads it as the sole module in the worker_loaders Map, so its
 * single `@skmtc/core` instance carries the cross-generator coordination +
 * attribution singletons.
 *
 * (Replaces the old split build — a project bundle with `@skmtc/core` /
 * `@skmtc/server` externalised into separately-uploaded runtime halves, plus
 * flat-specifier normalization to keep one core instance across the three
 * modules. A single self-contained bundle makes one-core-instance trivial and
 * deletes that whole subsystem.)
 */

import { join } from '@std/path/join'
import type { Project } from '@/lib/project.ts'
import { toBundleFailureMessage } from '@/lib/create-bundle.ts'

const SERVER_ENTRY = 'server.ts'
const SERVER_BUNDLE = 'server.js'

export type BundleDeployResult = {
  projectBundlePath: string
}

type BundleDeployArgs = {
  project: Project
}

const runDenoBundle = async ({
  cwd,
  entry,
  output
}: {
  cwd: string
  entry: string
  output: string
}): Promise<void> => {
  const command = new Deno.Command('deno', {
    args: ['bundle', '--platform', 'browser', '-o', output, entry],
    cwd,
    stdout: 'piped',
    stderr: 'piped',
    env: {
      ...Deno.env.toObject(),
      JSR_URL: Deno.env.get('JSR_URL') ?? 'https://jsr.io/'
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

export const bundleDeploy = async ({ project }: BundleDeployArgs): Promise<BundleDeployResult> => {
  const projectPath = project.toPath()

  // Emit the `server.ts` entry (createServer + generator composition) and pin
  // `@skmtc/server` / `@skmtc/core` so the `deno bundle` subprocess resolves
  // them — they're inlined into the output, not externalised.
  await project.createServer()

  await runDenoBundle({ cwd: projectPath, entry: SERVER_ENTRY, output: SERVER_BUNDLE })

  return { projectBundlePath: join(projectPath, SERVER_BUNDLE) }
}
