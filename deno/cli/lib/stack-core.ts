import { compare } from '@std/semver/compare'
import { greaterOrEqual } from '@std/semver/greater-or-equal'
import { satisfies } from '@std/semver/satisfies'
import { tryParse } from '@std/semver/try-parse'
import { tryParseRange } from '@std/semver/try-parse-range'
import type { Range, SemVer } from '@std/semver/types'
import { dirname } from '@std/path/dirname'
import { isAbsolute } from '@std/path/is-absolute'
import { join } from '@std/path/join'
import { parseModuleName } from '@skmtc/core/parseModuleName'
import { Jsr } from '@/lib/jsr.ts'
import type { RootDenoJson } from '@/lib/root-deno-json.ts'
import { toProjectPath } from '@/lib/to-project-path.ts'
import { WORKER_CORE_RANGES } from '@/lib/worker-core-ranges.ts'

/**
 * The generator stack decides which `@skmtc/core` a project runs (#333).
 * The CLI drives the run; nothing it brings constrains that choice. This
 * module holds the decisions that follow from it:
 *
 * - which core the project pins: one exact version that satisfies the core
 *   range of every generator in the project ({@link planCorePin});
 * - which module the CLI-generated `worker.ts` imports `toWorker` from:
 *   the project's own core (`@skmtc/core/worker`) when that core ships it,
 *   or `@skmtc/worker` for a stack on an older core ({@link toWorkerModule}).
 */

/** The first `@skmtc/core` release that exports `./worker`. */
export const FIRST_CORE_WITH_WORKER = '0.39.0'

export type WorkerModule = '@skmtc/core/worker' | '@skmtc/worker'

const CORE_PREFIX = 'jsr:@skmtc/core@'
const WORKER_PREFIX = 'jsr:@skmtc/worker@'

/**
 * A project's `@skmtc/core` import, by what the CLI may do with it:
 * - `exact`: a `jsr:` pin to one version, which the CLI writes;
 * - `range`: any other `jsr:` range (`^0.38.0`, `~0.38.0`, `0.38`, `latest`);
 * - `local`: a path to a core checkout, which the user owns;
 * - `other`: any other specifier (`npm:`, `https:`), also the user's.
 */
export type CorePin =
  | { type: 'exact'; version: string }
  | { type: 'range'; range: string }
  | { type: 'local'; path: string }
  | { type: 'other'; value: string }

export const toCorePin = (value: string): CorePin => {
  if (value.startsWith(CORE_PREFIX)) {
    const range = value.slice(CORE_PREFIX.length)
    return tryParse(range) === undefined ? { type: 'range', range } : { type: 'exact', version: range }
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(value) && !value.startsWith('file:')) {
    return { type: 'other', value }
  }

  return { type: 'local', path: value }
}

type Imports = Record<string, string> | undefined

/**
 * The module `worker.ts` imports `toWorker` from. A jsr core takes it from
 * core from {@link FIRST_CORE_WITH_WORKER} on. A local core takes it from
 * core only when the import map names `@skmtc/core/worker`, since a map
 * entry that points at a file resolves no subpaths ({@link ensureWorkerDeps}
 * adds that entry when the checkout exports `./worker`).
 */
export const toWorkerModule = (imports: Imports): WorkerModule => {
  const value = imports?.['@skmtc/core']

  if (value === undefined) {
    return '@skmtc/worker'
  }

  const pin = toCorePin(value)

  if (pin.type === 'exact') {
    return isAtLeast({ version: pin.version, minimum: FIRST_CORE_WITH_WORKER })
      ? '@skmtc/core/worker'
      : '@skmtc/worker'
  }

  if (pin.type === 'local' && imports?.['@skmtc/core/worker'] !== undefined) {
    return '@skmtc/core/worker'
  }

  return '@skmtc/worker'
}

type IsAtLeastArgs = {
  version: string
  minimum: string
}

const isAtLeast = ({ version, minimum }: IsAtLeastArgs): boolean => {
  const parsed = tryParse(version)
  const first = tryParse(minimum)
  return parsed !== undefined && first !== undefined && greaterOrEqual(parsed, first)
}

/** The `@skmtc/core` range one generator needs, as its `deno.json` writes it. */
export type CoreRequirement = {
  generatorId: string
  range: string
}

type DenoJsonDeps = {
  coreRange: string | null
  /** `@skmtc/lang-*` imports, which carry the core of a generator that does not import it. */
  langModules: string[]
}

const toDenoJsonDeps = (denoJson: unknown): DenoJsonDeps => {
  if (typeof denoJson !== 'object' || denoJson === null || !('imports' in denoJson)) {
    return { coreRange: null, langModules: [] }
  }

  const { imports } = denoJson

  if (typeof imports !== 'object' || imports === null) {
    return { coreRange: null, langModules: [] }
  }

  const entries = Object.entries(imports).flatMap(([key, value]) =>
    typeof value === 'string' ? [{ key, value }] : []
  )
  const core = entries.find(({ key }) => key === '@skmtc/core')

  return {
    coreRange:
      core !== undefined && core.value.startsWith(CORE_PREFIX) ? core.value.slice(CORE_PREFIX.length) : null,
    langModules: entries
      .filter(({ key, value }) => key.startsWith('@skmtc/lang-') && value.startsWith('jsr:'))
      .map(({ value }) => value)
  }
}

/**
 * The core range in a parsed `deno.json`. A generator that reaches core
 * only through a `@skmtc/lang-*` package takes that package's range.
 */
export const readCoreRange = async (denoJson: unknown): Promise<string | null> => {
  const { coreRange, langModules } = toDenoJsonDeps(denoJson)

  if (coreRange !== null) {
    return coreRange
  }

  for (const moduleName of langModules) {
    const langRange = await readPublishedCoreRange(moduleName)
    if (langRange !== null) {
      return langRange
    }
  }

  return null
}

/**
 * The core range of a published package, given as `jsr:@scope/name@version`
 * where the version may be a range (`^0.2.0`). The range is resolved to the
 * version the registry would install first, because files are served only
 * under an exact version. `null` when the package has no `deno.json` or
 * names no core.
 */
export const readPublishedCoreRange = async (moduleName: string): Promise<string | null> => {
  const { scopeName, packageName, version } = parseModuleName(moduleName)

  if (scopeName === null || version === null) {
    return null
  }

  const exact = await Jsr.getLatestVersion({ scopeName, packageName, semver: version })
  const text = await Jsr.tryGetVersionFile({ scopeName, packageName, version: exact, path: 'deno.json' })

  return text === null ? null : await readCoreRange(JSON.parse(text))
}

/** The core range of a local generator folder, read from its `deno.json`. `null` when unreadable. */
const readLocalCoreRange = async (denoJsonPath: string): Promise<string | null> => {
  try {
    return await readCoreRange(JSON.parse(await Deno.readTextFile(denoJsonPath)))
  } catch {
    return null
  }
}

type ReadInstalledRequirementsArgs = {
  denoJson: RootDenoJson
  /** Generator ids left out, such as the ones a command is replacing. */
  except?: string[]
}

/** The core range of every generator already in the project, except the named ones. */
export const readInstalledRequirements = async ({
  denoJson,
  except = []
}: ReadInstalledRequirementsArgs): Promise<CoreRequirement[]> => {
  const imports = denoJson.contents.imports ?? {}
  const generatorIds = denoJson.toGeneratorIds().filter(id => !except.includes(id))

  const ranges = await Promise.all(
    generatorIds.map(async generatorId => {
      const value = imports[generatorId]

      if (value === undefined) {
        return null
      }

      const range = value.startsWith('jsr:')
        ? await readPublishedCoreRange(value)
        : await readLocalCoreRange(toLocalDenoJsonPath({ denoJson, modulePath: value }))

      return range === null ? null : { generatorId, range }
    })
  )

  return ranges.flatMap(requirement => (requirement === null ? [] : [requirement]))
}

type ToLocalDenoJsonPathArgs = {
  denoJson: RootDenoJson
  modulePath: string
}

const toLocalDenoJsonPath = ({ denoJson, modulePath }: ToLocalDenoJsonPathArgs): string => {
  const folder = dirname(modulePath)
  return isAbsolute(folder) ? join(folder, 'deno.json') : join(toProjectPath(denoJson.projectName), folder, 'deno.json')
}

type ParsedRequirement = CoreRequirement & { parsed: Range }

export type CorePlan =
  | { type: 'keep' }
  | { type: 'set'; version: string }
  | { type: 'conflict'; requirements: CoreRequirement[] }

type PlanCorePinArgs = {
  /** The project's current `@skmtc/core` import. */
  current: string | undefined
  /** The core range of every generator the project will hold. */
  requirements: CoreRequirement[]
}

/**
 * The project's core pin for a set of generators: one exact version that
 * satisfies every range under semver rules, the same rules Deno resolves
 * by. One bundle holds one core, so a version that satisfies every range
 * is the only correct pin.
 *
 * - A local or other pin is the user's: keep it.
 * - No ranges: keep whatever is there.
 * - An exact pin that satisfies every range: keep it.
 * - Otherwise: the highest version a range names that satisfies every
 *   range, or a conflict listing them. A `range` pin is always replaced,
 *   because Deno resolves it to the newest match, which may satisfy none.
 */
export const planCorePin = ({ current, requirements }: PlanCorePinArgs): CorePlan => {
  const pin = current === undefined ? undefined : toCorePin(current)

  if (pin?.type === 'local' || pin?.type === 'other' || requirements.length === 0) {
    return { type: 'keep' }
  }

  const parsed = requirements.map(requirement => ({
    ...requirement,
    parsed: tryParseRange(requirement.range)
  }))
  const readable = parsed.flatMap(({ parsed, ...requirement }) =>
    parsed === undefined ? [] : [{ ...requirement, parsed }]
  )

  if (readable.length !== parsed.length) {
    return { type: 'conflict', requirements }
  }

  const satisfiesAll = (version: SemVer) => readable.every(({ parsed }) => satisfies(version, parsed))

  const currentVersion = pin?.type === 'exact' ? tryParse(pin.version) : undefined

  if (currentVersion !== undefined && satisfiesAll(currentVersion)) {
    return { type: 'keep' }
  }

  const candidates = [...toNamedVersions(readable), ...(currentVersion === undefined ? [] : [currentVersion])]
    .filter(satisfiesAll)
    .sort((a, b) => compare(b, a))

  const best = candidates[0]

  return best === undefined
    ? { type: 'conflict', requirements }
    : { type: 'set', version: `${best.major}.${best.minor}.${best.patch}` }
}

/** The versions the ranges name (`^0.38.2` names 0.38.2), as candidates for the pin. */
const toNamedVersions = (requirements: ParsedRequirement[]): SemVer[] =>
  requirements.flatMap(({ range }) => {
    const version = tryParse(range.replace(/^[\^~=v<>\s]+/, ''))
    return version === undefined ? [] : [version]
  })

/**
 * No one `@skmtc/core` version satisfies every generator in the project.
 * One bundle holds one core, so the command stops before deno.json changes.
 */
export class CoreConflictError extends Error {
  readonly requirements: CoreRequirement[]

  constructor(requirements: CoreRequirement[]) {
    const lines = requirements.map(({ generatorId, range }) => `  ${generatorId} needs @skmtc/core ${range}`)
    super(
      [
        'No one @skmtc/core version satisfies every generator in this project, and one project runs one core:',
        ...lines,
        'Install versions of these generators built on the same core minor, or remove one of them.'
      ].join('\n')
    )
    this.name = 'CoreConflictError'
    this.requirements = requirements
  }
}

type ApplyCorePlanArgs = {
  denoJson: RootDenoJson
  plan: CorePlan
}

/** Writes a plan into `denoJson`, or throws {@link CoreConflictError}. Does not save. */
export const applyCorePlan = ({ denoJson, plan }: ApplyCorePlanArgs) => {
  if (plan.type === 'conflict') {
    throw new CoreConflictError(plan.requirements)
  }

  if (plan.type === 'keep') {
    return
  }

  denoJson.addImport('@skmtc/core', `${CORE_PREFIX}${plan.version}`)

  // A published worker pin was chosen for the old core; the next build
  // chooses again. A local worker override is the user's and stays.
  if (denoJson.contents.imports?.['@skmtc/worker']?.startsWith(WORKER_PREFIX)) {
    denoJson.removeImport('@skmtc/worker')
  }
}

/** A generator a command adds or replaces, with its core range (`null` when it names none). */
export type AddedGenerator = {
  generatorId: string
  range: string | null
}

type ReconcileCorePinArgs = {
  denoJson: RootDenoJson
  adding: AddedGenerator[]
}

/**
 * Plans the project's core pin for the generators that stay plus the ones
 * being added, and writes it into `denoJson` (not saved). Throws
 * {@link CoreConflictError} before any change when no core fits them all.
 */
export const reconcileCorePin = async ({ denoJson, adding }: ReconcileCorePinArgs) => {
  const installed = await readInstalledRequirements({
    denoJson,
    except: adding.map(({ generatorId }) => generatorId)
  })
  const added = adding.flatMap(({ generatorId, range }) => (range === null ? [] : [{ generatorId, range }]))

  applyCorePlan({
    denoJson,
    plan: planCorePin({ current: denoJson.contents.imports?.['@skmtc/core'], requirements: [...installed, ...added] })
  })
}

/**
 * The newest published `@skmtc/worker` that runs on `coreVersion`, for a
 * stack on a core older than {@link FIRST_CORE_WITH_WORKER}. Read from a
 * fixed table, since those worker versions never change. `null` when none
 * does.
 */
export const findWorkerVersionForCore = (coreVersion: string): string | null => {
  const version = tryParse(coreVersion)

  if (version === undefined) {
    return null
  }

  const match = WORKER_CORE_RANGES.find(([, range]) => {
    const parsed = tryParseRange(range)
    return parsed !== undefined && satisfies(version, parsed)
  })

  return match === undefined ? null : match[0]
}

type LocalCoreWorkerArgs = {
  denoJson: RootDenoJson
  corePath: string
}

/**
 * The import-map value for `@skmtc/core/worker` of a local core checkout,
 * read from the checkout's `deno.json` exports. `null` when the checkout
 * predates `./worker` or can't be read.
 */
export const toLocalCoreWorkerPath = async ({ denoJson, corePath }: LocalCoreWorkerArgs): Promise<string | null> => {
  const folder = dirname(corePath.replace(/^file:\/\//, ''))
  const configPath = isAbsolute(folder)
    ? join(folder, 'deno.json')
    : join(toProjectPath(denoJson.projectName), folder, 'deno.json')

  try {
    const config: unknown = JSON.parse(await Deno.readTextFile(configPath))
    const exportPath = toWorkerExport(config)

    if (exportPath === null) {
      return null
    }

    const joined = join(folder, exportPath)
    return isAbsolute(joined) || joined.startsWith('.') ? joined : `./${joined}`
  } catch {
    return null
  }
}

const toWorkerExport = (config: unknown): string | null => {
  if (typeof config !== 'object' || config === null || !('exports' in config)) {
    return null
  }

  const { exports } = config

  if (typeof exports !== 'object' || exports === null || !('./worker' in exports)) {
    return null
  }

  const value = exports['./worker']
  return typeof value === 'string' ? value : null
}
