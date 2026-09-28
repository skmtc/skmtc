import { join } from '@std/path/join'
import type { Project } from '@/lib/project.ts'
import { toBundlePath } from '@/lib/to-bundle-path.ts'
import { toDependencyAgeArgs } from '@/lib/dependency-age.ts'
import { checkModuleGraph, toDuplicatePackagesMessage } from '@/lib/duplicate-packages.ts'

/**
 * Build a project's `bundle.js` from its generated `worker.ts`.
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
  project: Project
}

export const createBundle = async ({ project }: CreateBundleArgs): Promise<string> => {
  const fileName = 'bundle.js'
  const projectPath = project.toPath()
  const bundlePath = toBundlePath(project.toPath())

  const workerPath = join(projectPath, 'worker.ts')
  const previousWorker = await readTextFileIfExists(workerPath)

  await project.createWorker()

  const graphCheck = await checkModuleGraph(projectPath)
  if (graphCheck.type === 'duplicates') {
    // Put back the worker.ts the current bundle.js was built from, so the
    // freshness gate still reports that bundle as stale against deno.json.
    await restoreFile(workerPath, previousWorker)
    throw new Error(
      toDuplicatePackagesMessage({
        projectName: project.name,
        projectPath,
        duplicates: graphCheck.duplicates
      })
    )
  }

  // Without the age flag, `deno bundle` on Deno ≥ 2.9 rejects a freshly
  // released stack — the project's pins name `@skmtc/*` versions that
  // publish on every merge, so they are younger than the default cutoff.
  // Same rationale as the installer's flag on `deno install`
  // (skmtc-hub/apps/install); see `@/lib/dependency-age.ts`.
  const command = new Deno.Command('deno', {
    args: ['bundle', ...toDependencyAgeArgs(), '-o', fileName, 'worker.ts'],
    cwd: projectPath,
    stdout: 'piped',
    stderr: 'piped'
  })

  const logsPath = join(projectPath, '.settings', 'logs.txt')
  const errorLogsPath = join(projectPath, '.settings', 'error-logs.txt')

  const { success, stdout, stderr } = await command.output()

  let logsFile: Deno.FsFile | undefined
  try {
    // Read stdout and write to file. Assign the outer binding (no
    // `const`) so `finally` actually closes the handle.
    logsFile = await Deno.open(logsPath, { create: true, append: true })
    await logsFile.write(stdout)
  } catch (error) {
    console.error(error)
    throw error
  } finally {
    logsFile?.close()
  }

  let errorLogsFile: Deno.FsFile | undefined
  try {
    errorLogsFile = await Deno.open(errorLogsPath, { create: true, append: true })
    await errorLogsFile.write(stderr)
  } catch (error) {
    console.error(error)
    throw error
  } finally {
    errorLogsFile?.close()
  }

  if (!success) {
    throw new Error(toBundleFailureMessage({ projectPath, errorLogsPath, stderr }))
  }

  return bundlePath
}

const readTextFileIfExists = async (path: string): Promise<string | undefined> => {
  try {
    return await Deno.readTextFile(path)
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return undefined
    throw error
  }
}

const restoreFile = async (path: string, contents: string | undefined): Promise<void> => {
  if (contents === undefined) {
    await Deno.remove(path)
  } else {
    await Deno.writeTextFile(path, contents)
  }
}

type ToBundleFailureMessageArgs = {
  projectPath: string
  errorLogsPath: string
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
    `Full output: ${errorLogsPath}`
  ].join('\n\n')
}
