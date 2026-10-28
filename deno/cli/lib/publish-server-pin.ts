import { join } from '@std/path/join'
import { readCliServerPin } from '@/lib/doctor-headless.ts'
import { toDependencyAgeArgs } from '@/lib/dependency-age.ts'

const SERVER_PACKAGE = '@skmtc/server'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Pin `@skmtc/server` in the project `deno.json` before a publish. The hub
 * deploys a version by synthesizing a `server.ts` that imports
 * `@skmtc/server` through the uploaded import map, so a version published
 * without the pin can never deploy. The rule is `ensureServerDeps`'s: add the
 * pin when absent, repin a different JSR version to the CLI's, and leave a
 * non-JSR override (a local checkout) alone.
 *
 * Returns whether the file changed.
 */
export const pinServerForPublish = async (projectPath: string): Promise<boolean> => {
  const version = readCliServerPin()
  if (version === null) return false

  const denoJsonPath = join(projectPath, 'deno.json')
  const parsed: unknown = JSON.parse(await Deno.readTextFile(denoJsonPath))
  if (!isRecord(parsed)) {
    throw new Error(`${denoJsonPath} is not a JSON object`)
  }

  const imports = isRecord(parsed.imports) ? parsed.imports : {}
  const current = imports[SERVER_PACKAGE]
  const wanted = `jsr:${SERVER_PACKAGE}@${version}`

  if (current === wanted) return false
  if (typeof current === 'string' && !current.startsWith(`jsr:${SERVER_PACKAGE}@`)) return false

  const updated = { ...parsed, imports: { ...imports, [SERVER_PACKAGE]: wanted } }
  await Deno.writeTextFile(denoJsonPath, `${JSON.stringify(updated, null, 2)}\n`)

  return true
}

/** Run `deno install` in the project so `deno.lock` resolves a changed import map. */
export const refreshProjectLock = async (projectPath: string): Promise<void> => {
  const { success, stderr } = await new Deno.Command('deno', {
    args: ['install', ...toDependencyAgeArgs()],
    cwd: projectPath,
    stdout: 'null',
    stderr: 'piped'
  }).output()

  if (!success) {
    throw new Error(
      `deno install failed in ${projectPath} after pinning ${SERVER_PACKAGE}: ` +
        new TextDecoder().decode(stderr).trim()
    )
  }
}
