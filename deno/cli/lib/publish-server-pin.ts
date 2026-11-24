import { join } from '@std/path/join'
import { compare } from '@std/semver/compare'
import { satisfies } from '@std/semver/satisfies'
import { tryParse } from '@std/semver/try-parse'
import { tryParseRange } from '@std/semver/try-parse-range'
import { readCliServerPin } from '@/lib/doctor-headless.ts'
import { toDependencyAgeArgs } from '@/lib/dependency-age.ts'
import { Jsr } from '@/lib/jsr.ts'
import { readPublishedCoreRange, toCorePin } from '@/lib/stack-core.ts'

const SERVER_PACKAGE = '@skmtc/server'
const SERVER_PREFIX = `jsr:${SERVER_PACKAGE}@`

/** A pin `pinServerForPublish` changed in the project `deno.json`. */
export type ServerPinChange = {
  package: typeof SERVER_PACKAGE
  /** The pin before, `null` when there was none. */
  from: string | null
  to: string
}

/** No published `@skmtc/server` up to the CLI's own accepts the project's core. */
export class NoServerForCoreError extends Error {
  constructor({ core, tried }: { core: string; tried: string[] }) {
    const newest = tried[0]
    const oldest = tried.at(-1)
    super(
      [
        `No published ${SERVER_PACKAGE} accepts the project's @skmtc/core ${core}`,
        `(tried ${tried.length} versions, ${newest} down to ${oldest}).`,
        "Move the project's generators to a core that a server accepts, or update the CLI."
      ].join(' ')
    )
    this.name = 'NoServerForCoreError'
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

type PinServerForPublishOptions = {
  /** The CLI's own `@skmtc/server` pin; a seam for tests. */
  cliVersion?: string | null
}

/**
 * Pin `@skmtc/server` in the project `deno.json` before a deploy uploads the
 * version. The hub deploys a version by synthesizing a `server.ts` that
 * imports `@skmtc/server` through the uploaded import map, so a version
 * stored without the pin can never deploy.
 *
 * The pin is the newest published server, no newer than the CLI's own pin,
 * whose `@skmtc/core` range accepts the project's exact core pin: a server on
 * another core puts two cores in `deno.lock`, and the hub refuses the upload
 * (#373). Without an exact core pin it is the CLI's version. A non-JSR
 * override (a local checkout) is left alone.
 *
 * Returns the change, or `null` when the file is unchanged.
 */
export const pinServerForPublish = async (
  projectPath: string,
  { cliVersion = readCliServerPin() }: PinServerForPublishOptions = {}
): Promise<ServerPinChange | null> => {
  if (cliVersion === null) return null

  const denoJsonPath = join(projectPath, 'deno.json')
  const parsed: unknown = JSON.parse(await Deno.readTextFile(denoJsonPath))
  if (!isRecord(parsed)) {
    throw new Error(`${denoJsonPath} is not a JSON object`)
  }

  const imports = isRecord(parsed.imports) ? parsed.imports : {}
  const current = typeof imports[SERVER_PACKAGE] === 'string' ? imports[SERVER_PACKAGE] : null
  if (current !== null && !current.startsWith(SERVER_PREFIX)) return null

  const corePin =
    typeof imports['@skmtc/core'] === 'string' ? toCorePin(imports['@skmtc/core']) : null
  const version =
    corePin?.type === 'exact'
      ? await findServerForCore({ core: corePin.version, cliVersion })
      : cliVersion
  const wanted = `${SERVER_PREFIX}${version}`

  if (current === wanted) return null

  const updated = { ...parsed, imports: { ...imports, [SERVER_PACKAGE]: wanted } }
  await Deno.writeTextFile(denoJsonPath, `${JSON.stringify(updated, null, 2)}\n`)

  return { package: SERVER_PACKAGE, from: current, to: wanted }
}

type FindServerForCoreArgs = {
  core: string
  cliVersion: string
}

/**
 * The newest published server, no newer than `cliVersion`, whose core range
 * accepts `core`. The CLI's own version is tried first and needs no listing.
 */
const findServerForCore = async ({ core, cliVersion }: FindServerForCoreArgs): Promise<string> => {
  const coreVersion = tryParse(core)
  if (coreVersion === undefined) return cliVersion

  const accepts = async (version: string): Promise<boolean> => {
    const range = await readPublishedCoreRange(`${SERVER_PREFIX}${version}`)
    const parsed = range === null ? undefined : tryParseRange(range)
    return parsed !== undefined && satisfies(coreVersion, parsed)
  }

  if (await accepts(cliVersion)) return cliVersion

  const ceiling = tryParse(cliVersion)
  const { versions } = await Jsr.getLatestMeta({ scopeName: '@skmtc', packageName: 'server' })
  const older = Object.entries(versions)
    .flatMap(([version, { yanked }]) => {
      const parsed = tryParse(version)
      return yanked === true || parsed === undefined || parsed.prerelease?.length
        ? []
        : [{ version, parsed }]
    })
    .filter(({ parsed }) => ceiling === undefined || compare(parsed, ceiling) < 0)
    .sort((a, b) => compare(b.parsed, a.parsed))
    .map(({ version }) => version)

  for (const version of older) {
    if (await accepts(version)) return version
  }

  throw new NoServerForCoreError({ core, tried: [cliVersion, ...older] })
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
