import { join } from '@std/path/join'
import { compare } from '@std/semver/compare'
import { greaterThanRange } from '@std/semver/greater-than-range'
import { satisfies } from '@std/semver/satisfies'
import { tryParse } from '@std/semver/try-parse'
import { tryParseRange } from '@std/semver/try-parse-range'
import type { SemVer } from '@std/semver/types'
import { readCliServerPin } from '@/lib/doctor-headless.ts'
import { toDependencyAgeArgs } from '@/lib/dependency-age.ts'
import { Jsr, type JsrPkgMetaVersions } from '@/lib/jsr.ts'
import { readCoreRange, toCorePin } from '@/lib/stack-core.ts'

const SERVER_PACKAGE = '@skmtc/server'
const SERVER_PREFIX = `jsr:${SERVER_PACKAGE}@`
const SERVER = { scopeName: '@skmtc', packageName: 'server' } as const

/**
 * The oldest server the hub can deploy. The hub's stack wrapper always
 * POSTs `{ protocol, schema, clientSettings }` to the server's `/artifacts`,
 * and 0.1.0 is the first version that reads `protocol` (skmtc 862e41307).
 * On jsr.io the first version at or above it is 0.2.13.
 */
const MIN_SERVER_VERSION = '0.1.0'

/** How long the version listing may take: it is one larger file. */
const LISTING_TIMEOUT_MS = 15_000

/** A pin `pinServerForPublish` changed in the project `deno.json`. */
export type ServerPinChange = {
  package: typeof SERVER_PACKAGE
  /** The pin before, `null` when there was none. */
  from: string | null
  to: string
}

/**
 * Why no server fits: the project's core is newer than the CLI's own server
 * takes, so a newer CLI can help; or no published server takes it at all.
 */
type NoServerReason = 'core-too-new' | 'no-server'

/** No published `@skmtc/server` up to the CLI's own accepts the project's core. */
export class NoServerForCoreError extends Error {
  readonly reason: NoServerReason

  constructor({ core, tried, reason }: { core: string; tried: string[]; reason: NoServerReason }) {
    const triedText =
      tried.length === 1
        ? tried[0]
        : `${tried.length} versions, ${tried[0]} down to ${tried.at(-1)}`
    super(
      [
        `No published ${SERVER_PACKAGE} accepts the project's @skmtc/core ${core} (tried ${triedText}).`,
        reason === 'core-too-new'
          ? "The project's core is newer than this CLI's server: update the CLI."
          : "Move the project's generators to a core that a published server accepts."
      ].join(' ')
    )
    this.name = 'NoServerForCoreError'
    this.reason = reason
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
 * The pin is the newest published server, from {@link MIN_SERVER_VERSION} up
 * to the CLI's own pin, whose `@skmtc/core` range accepts the project's core:
 * a server on another core puts two cores in `deno.lock`, and the hub refuses
 * the upload (#373). The project's core is its exact pin, or for a range the
 * version its `deno.lock` resolves. With a local core it is the CLI's
 * version. A non-JSR server override (a local checkout) is left alone.
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

  const core = await readProjectCore({ projectPath, imports })
  const version = core === null ? cliVersion : await findServerForCore({ core, cliVersion })
  const wanted = `${SERVER_PREFIX}${version}`

  if (current === wanted) return null

  const updated = { ...parsed, imports: { ...imports, [SERVER_PACKAGE]: wanted } }
  await Deno.writeTextFile(denoJsonPath, `${JSON.stringify(updated, null, 2)}\n`)

  return { package: SERVER_PACKAGE, from: current, to: wanted }
}

type ReadProjectCoreArgs = {
  projectPath: string
  imports: Record<string, unknown>
}

/**
 * The `@skmtc/core` version the project runs on: its exact pin, or for a
 * range the one version `deno.lock` resolves. `null` for a local or other
 * core, and for no pin. Throws when a range has no single locked version,
 * because the server cannot be chosen then.
 */
const readProjectCore = async ({ projectPath, imports }: ReadProjectCoreArgs): Promise<string | null> => {
  const value = imports['@skmtc/core']
  if (typeof value !== 'string') return null

  const pin = toCorePin(value)
  if (pin.type === 'exact') return pin.version
  if (pin.type !== 'range') return null

  const locked = await readLockedCoreVersions(projectPath)
  if (locked.length === 1) return locked[0]

  throw new Error(
    locked.length === 0
      ? `deno.lock resolves no @skmtc/core for the range ${pin.range}. Pin @skmtc/core exactly in deno.json, then deploy again.`
      : `deno.lock resolves more than one @skmtc/core (${locked.join(', ')}). Pin @skmtc/core exactly in deno.json, then deploy again.`
  )
}

/** The `@skmtc/core` versions in the project's `deno.lock`, as `jsr` entry keys name them. */
const readLockedCoreVersions = async (projectPath: string): Promise<string[]> => {
  const parsed: unknown = JSON.parse(await Deno.readTextFile(join(projectPath, 'deno.lock')))
  const jsr = isRecord(parsed) && isRecord(parsed.jsr) ? parsed.jsr : {}
  const prefix = '@skmtc/core@'

  return Object.keys(jsr).flatMap(key => (key.startsWith(prefix) ? [key.slice(prefix.length)] : []))
}

type FindServerForCoreArgs = {
  core: string
  cliVersion: string
}

/**
 * The newest published server, no newer than `cliVersion`, whose core range
 * accepts `core`. The CLI's version and the listing are read together.
 */
const findServerForCore = async ({ core, cliVersion }: FindServerForCoreArgs): Promise<string> => {
  const coreVersion = tryParse(core)
  if (coreVersion === undefined) return cliVersion

  const [cliFit, listing] = await Promise.all([
    readServerFit({ version: cliVersion, coreVersion }),
    Jsr.tryGetLatestMeta({ ...SERVER, timeoutMs: LISTING_TIMEOUT_MS })
  ])

  // The CLI's version unknown: pin it, as before #373.
  if (cliFit.type === 'unreadable') {
    console.error(
      `Warning: could not read ${SERVER_PACKAGE} ${cliVersion} from the registry (${cliFit.reason}). ` +
        `Pinning the CLI's version.`
    )
    return cliVersion
  }

  if (cliFit.fit === 'older') {
    throw new NoServerForCoreError({ core, tried: [cliVersion], reason: 'core-too-new' })
  }

  const yanked = listing?.versions[cliVersion]?.yanked === true
  if (cliFit.fit === 'accepts' && !yanked) return cliVersion

  // The CLI's version is known not to fit (or is yanked), so pinning it would
  // bring the two-core 422 back: search, or stop.
  const why = yanked ? 'is yanked' : `does not accept the project's @skmtc/core ${core}`
  if (listing === undefined) {
    throw new Error(
      `${SERVER_PACKAGE} ${cliVersion} ${why}, and the registry's list of ${SERVER_PACKAGE} versions could not be read.`
    )
  }

  try {
    return await searchOlderServers({ core, coreVersion, cliVersion, listing })
  } catch (error) {
    if (error instanceof NoServerForCoreError) throw error

    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(
      `${SERVER_PACKAGE} ${cliVersion} ${why}, and the registry could not be read to find a version that does: ${reason}`
    )
  }
}

/** How a server version's core range relates to the project's core. */
type ServerFit = 'accepts' | 'older' | 'other'

type ServerRead = { type: 'read'; fit: ServerFit } | { type: 'unreadable'; reason: string }

type ReadServerFitArgs = { version: string; coreVersion: SemVer }

/** The fit of one server version. A failed read or a missing `deno.json` is `unreadable`. */
const readServerFit = async ({ version, coreVersion }: ReadServerFitArgs): Promise<ServerRead> => {
  try {
    const text = await Jsr.tryGetVersionFile({ ...SERVER, version, path: 'deno.json' })
    if (text === null) return { type: 'unreadable', reason: `no deno.json for ${version}` }

    const range = await readCoreRange(JSON.parse(text))
    const parsed = range === null ? undefined : tryParseRange(range)

    if (parsed === undefined) return { type: 'read', fit: 'other' }
    if (satisfies(coreVersion, parsed)) return { type: 'read', fit: 'accepts' }
    // The core is newer than any this server takes, and an older server takes older cores still.
    return { type: 'read', fit: greaterThanRange(coreVersion, parsed) ? 'older' : 'other' }
  } catch (error) {
    return { type: 'unreadable', reason: error instanceof Error ? error.message : String(error) }
  }
}

/** How many versions are read at once while searching. */
const SEARCH_BATCH = 16

type SearchOlderServersArgs = FindServerForCoreArgs & {
  coreVersion: SemVer
  listing: JsrPkgMetaVersions
}

/**
 * The versions below the CLI's and at or above {@link MIN_SERVER_VERSION},
 * newest first, read in batches and walked in order. A failed read stops the
 * walk only when no newer version in the batch has decided it.
 */
const searchOlderServers = async ({
  core,
  coreVersion,
  cliVersion,
  listing
}: SearchOlderServersArgs): Promise<string> => {
  const ceiling = tryParse(cliVersion)
  const floor = tryParse(MIN_SERVER_VERSION)
  const older = Object.entries(listing.versions)
    .flatMap(([version, { yanked }]) => {
      const parsed = tryParse(version)
      return yanked === true || parsed === undefined || parsed.prerelease?.length
        ? []
        : [{ version, parsed }]
    })
    .filter(({ parsed }) => ceiling === undefined || compare(parsed, ceiling) < 0)
    .filter(({ parsed }) => floor === undefined || compare(parsed, floor) >= 0)
    .sort((a, b) => compare(b.parsed, a.parsed))
    .map(({ version }) => version)

  const tried = [cliVersion]
  const batches = Array.from({ length: Math.ceil(older.length / SEARCH_BATCH) }, (_, index) =>
    older.slice(index * SEARCH_BATCH, (index + 1) * SEARCH_BATCH)
  )

  for (const batch of batches) {
    const reads = await Promise.all(batch.map(version => readServerFit({ version, coreVersion })))

    for (const [index, read] of reads.entries()) {
      const version = batch[index]
      tried.push(version)

      if (read.type === 'unreadable') {
        throw new Error(`could not read ${SERVER_PACKAGE} ${version}: ${read.reason}`)
      }
      if (read.fit === 'accepts') return version
      if (read.fit === 'older') throw new NoServerForCoreError({ core, tried, reason: 'no-server' })
    }
  }

  throw new NoServerForCoreError({ core, tried, reason: 'no-server' })
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
