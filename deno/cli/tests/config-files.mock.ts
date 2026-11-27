import { ensureDir } from '@std/fs/ensure-dir'
import { join } from '@std/path/join'
import { homedir } from 'node:os'
import { resetReportedDeprecations } from '@/lib/project-config.ts'

/** A project's config files: each file name and the JSON it holds. */
export type ConfigFiles = {
  'skmtc.config.json'?: unknown
  'client.json'?: unknown
}

export type ConfigRoot = {
  tempRoot: string
  /** The `.settings` directory of `projectName`. */
  settingsPath: (projectName: string) => string
  /** The text of a project's config file; `undefined` when it does not exist. */
  readFile: (projectName: string, fileName: keyof ConfigFiles) => string | undefined
}

/**
 * Creates `.skmtc/<project>/.settings/` with the given config files in a
 * temp dir inside the home directory (where `toRootPath` looks), and cd's
 * into it for the duration of `fn`. Each config is written with two-space
 * indents, as the CLI writes it.
 */
export const withConfigRoot = async (
  projects: Record<string, ConfigFiles>,
  fn: (root: ConfigRoot) => Promise<void> | void
): Promise<void> => {
  const tempRoot = await Deno.makeTempDir({ dir: homedir(), prefix: 'config-files-' })
  const settingsPath = (projectName: string) => join(tempRoot, '.skmtc', projectName, '.settings')

  for (const [projectName, files] of Object.entries(projects)) {
    await ensureDir(settingsPath(projectName))
    await Deno.writeTextFile(join(tempRoot, '.skmtc', projectName, 'deno.json'), JSON.stringify({ imports: {} }))

    for (const [fileName, config] of Object.entries(files)) {
      await Deno.writeTextFile(join(settingsPath(projectName), fileName), JSON.stringify(config, null, 2))
    }
  }

  const readFile = (projectName: string, fileName: keyof ConfigFiles) => {
    try {
      return Deno.readTextFileSync(join(settingsPath(projectName), fileName))
    } catch {
      return undefined
    }
  }

  const originalCwd = Deno.cwd()
  Deno.chdir(tempRoot)
  resetReportedDeprecations()

  try {
    await fn({ tempRoot, settingsPath, readFile })
  } finally {
    resetReportedDeprecations()
    Deno.chdir(originalCwd)
    await Deno.remove(tempRoot, { recursive: true })
  }
}

/** Runs `fn` and returns what it printed on stdout and on stderr, one entry for each call. */
export const captureConsole = async <T>(
  fn: () => Promise<T> | T
): Promise<{ value: T; stdout: string[]; stderr: string[] }> => {
  const stdout: string[] = []
  const stderr: string[] = []
  const originalLog = console.log
  const originalError = console.error
  console.log = (...args: unknown[]) => stdout.push(args.map(String).join(' '))
  console.error = (...args: unknown[]) => stderr.push(args.map(String).join(' '))

  try {
    return { value: await fn(), stdout, stderr }
  } finally {
    console.log = originalLog
    console.error = originalError
  }
}
