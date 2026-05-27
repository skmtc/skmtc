import { join } from '@std/path/join'
import type { Project } from '@/lib/project.ts'
import { toBundleFailureMessage } from '@/tasks/GenerateBundleTask.tsx'

const SERVER_ENTRY = 'server.ts'
const SERVER_BUNDLE = 'server.js'

type BundleServerArgs = {
  project: Project
}

/**
 * Bundle a project's CF-Workers entry. Generates `server.ts` from
 * installed generators, then shells out to
 * `deno bundle --platform browser server.ts -o server.js`. The output
 * is a single ESM file the runner Worker loads via `env.LOADER`.
 *
 * Parallels `createBundle` from `tasks/GenerateBundleTask.tsx` (the
 * Deno-Worker pipeline) — same subprocess shape, different entry +
 * output target.
 */
export const bundleServer = async ({ project }: BundleServerArgs): Promise<string> => {
  const projectPath = project.toPath()

  await project.createServer()

  const bundlePath = join(projectPath, SERVER_BUNDLE)

  // `--platform browser` instructs `deno bundle` to produce a
  // self-contained ESM blob suitable for non-Deno hosts (CF Workers).
  // The bundle target is browser-shaped because the consumer (CF
  // Workers V8 isolate) is closer to a browser than to Node.
  const command = new Deno.Command('deno', {
    args: ['bundle', '--platform', 'browser', '-o', SERVER_BUNDLE, SERVER_ENTRY],
    cwd: projectPath,
    stdout: 'piped',
    stderr: 'piped',
    env: {
      // Inherit the host's PATH plus point JSR resolution at the
      // private registry the @skmtc/* packages live in.
      ...Deno.env.toObject(),
      JSR_URL: Deno.env.get('JSR_URL') ?? 'https://jsr.skmtc.dev/'
    }
  })

  const logsPath = join(projectPath, '.settings', 'logs.txt')
  const errorLogsPath = join(projectPath, '.settings', 'error-logs.txt')

  const { success, stdout, stderr } = await command.output()

  await Deno.mkdir(join(projectPath, '.settings'), { recursive: true })
  await Deno.writeFile(logsPath, stdout, { append: true, create: true })
  await Deno.writeFile(errorLogsPath, stderr, { append: true, create: true })

  if (!success) {
    throw new Error(toBundleFailureMessage({ projectPath, errorLogsPath, stderr }))
  }

  return bundlePath
}
