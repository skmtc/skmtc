import { join } from '@std/path/join'
import type { Project } from '@/lib/project.ts'
import { toBundlePath } from '@/lib/to-bundle-path.ts'

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

  await project.createWorker()

  // --minimum-dependency-age=0 disables the dependency-age holdback
  // (enforced by default from Deno 2.9) for the bundle's own
  // resolution. @skmtc/* publishes on every merge, so the newest
  // generator/worker versions are always younger than the default
  // cutoff — without the flag, `deno bundle` on Deno ≥ 2.9 rejects a
  // freshly released stack with the misleading
  // `Do not know how to load path: deno:jsr:…`. Same rationale as the
  // installer's flag on `deno install` (skmtc-hub/apps/install).
  // The flag parses from Deno 2.6 (a no-op before the 2.9 gate) and is
  // an unknown-argument error on ≤ 2.5, so gate on the running Deno's
  // version — the subprocess resolves `deno` from PATH, the same
  // binary running this code in the supported setups.
  const [major, minor] = Deno.version.deno.split('.').map(Number)
  const ageArgs = major > 2 || (major === 2 && minor >= 6) ? ['--minimum-dependency-age=0'] : []

  const command = new Deno.Command('deno', {
    args: ['bundle', ...ageArgs, '-o', fileName, 'worker.ts'],
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
