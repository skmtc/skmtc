import { join } from '@std/path/join'
import { compare } from '@std/semver/compare'
import { greaterThanRange } from '@std/semver/greater-than-range'
import { satisfies } from '@std/semver/satisfies'
import { tryParse } from '@std/semver/try-parse'
import { tryParseRange } from '@std/semver/try-parse-range'
import type { SemVer } from '@std/semver/types'
import { readCliServerPin } from '@/lib/doctor-headless.ts'
import { toDependencyAgeArgs } from '@/lib/dependency-age.ts'
import { Jsr } from '@/lib/jsr.ts'
import { readCoreRange, toCorePin } from '@/lib/stack-core.ts'

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
    const triedText =
      tried.length === 1
        ? tried[0]
        : `${tried.length} versions, ${tried[0]} down to ${tried.at(-1)}`
    super(
      [
        `No published ${SERVER_PACKAGE} accepts the project's @skmtc/core ${core} (tried ${triedText}).`,
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
 * accepts `core`. The CLI's own version is checked first, with one request.
 */
const findServerForCore = async ({ core, cliVersion }: FindServerForCoreArgs): Promise<string> => {
  const coreVersion = tryParse(core)
  if (coreVersion === undefined) return cliVersion

  const cliFit = await readCliFit({ cliVersion, coreVersion })
  if (cliFit === 'accepts') return cliVersion
  if (cliFit === 'older') throw new NoServerForCoreError({ core, tried: [cliVersion] })

  try {
    return await searchOlderServers({ core, coreVersion, cliVersion })
  } catch (error) {
    if (error instanceof NoServerForCoreError) throw error

    // The CLI's version is known not to fit, so pinning it would put two
    // cores in deno.lock: stop instead.
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(
      `${SERVER_PACKAGE} ${cliVersion} does not accept the project's @skmtc/core ${core}, ` +
        `and the registry could not be read to find a version that does: ${reason}`
    )
  }
}

type ReadCliFitArgs = { cliVersion: string; coreVersion: SemVer }

/**
 * The fit of the CLI's own server. When the registry cannot be read, it
 * counts as a fit, with a warning: the pin is then the CLI's version, as
 * before #373.
 */
const readCliFit = async ({ cliVersion, coreVersion }: ReadCliFitArgs): Promise<ServerFit> => {
  try {
    return await toServerFit({ version: cliVersion, coreVersion })
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    console.error(
      `Warning: could not read ${SERVER_PACKAGE} ${cliVersion} from the registry (${reason}). ` +
        `Pinning the CLI's version.`
    )
    return 'accepts'
  }
}

/** How a server version's core range relates to the project's core. */
type ServerFit = 'accepts' | 'older' | 'other'

/** How many versions are read at once while searching. */
const SEARCH_BATCH = 16

const toServerFit = async ({
  version,
  coreVersion
}: {
  version: string
  coreVersion: SemVer
}): Promise<ServerFit> => {
  const text = await Jsr.tryGetVersionFile({
    scopeName: '@skmtc',
    packageName: 'server',
    version,
    path: 'deno.json'
  })
  const range = text === null ? null : await readCoreRange(JSON.parse(text))
  const parsed = range === null ? undefined : tryParseRange(range)

  if (parsed === undefined) return 'other'
  if (satisfies(coreVersion, parsed)) return 'accepts'
  // The core is newer than any this server takes, and an older server takes older cores still.
  return greaterThanRange(coreVersion, parsed) ? 'older' : 'other'
}

type SearchServerForCoreArgs = FindServerForCoreArgs & { coreVersion: SemVer }

/** The versions older than the CLI's, newest first, for a CLI version that does not fit. */
const searchOlderServers = async ({
  core,
  coreVersion,
  cliVersion
}: SearchServerForCoreArgs): Promise<string> => {
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

  const tried = [cliVersion]
  const batches = Array.from({ length: Math.ceil(older.length / SEARCH_BATCH) }, (_, index) =>
    older.slice(index * SEARCH_BATCH, (index + 1) * SEARCH_BATCH)
  )

  for (const batch of batches) {
    const fits = await Promise.all(batch.map(version => toServerFit({ version, coreVersion })))

    for (const [index, fit] of fits.entries()) {
      tried.push(batch[index])
      if (fit === 'accepts') return batch[index]
      if (fit === 'older') throw new NoServerForCoreError({ core, tried })
    }
  }

  throw new NoServerForCoreError({ core, tried })
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
