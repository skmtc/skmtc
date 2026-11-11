import { compare } from '@std/semver/compare'
import { greaterOrEqual } from '@std/semver/greater-or-equal'
import { tryParse } from '@std/semver/try-parse'
import { toJsrUrl } from '@/lib/jsr-registry.ts'
import type { RootDenoJson } from '@/lib/root-deno-json.ts'

/**
 * The generator stack decides which `@skmtc/core` a project runs (#333).
 * The CLI drives the run; nothing it brings constrains that choice. This
 * module holds the two decisions that follow from it:
 *
 * - which module the CLI-generated `worker.ts` imports `toWorker` from:
 *   the project's own core (`@skmtc/core/worker`) when that core ships it,
 *   or `@skmtc/worker` for stacks on an older core;
 * - which core the project pins: the one its generators need, read from
 *   each generator version's published `deno.json`.
 */

/** The first `@skmtc/core` release that exports `./worker`. */
export const FIRST_CORE_WITH_WORKER = '0.39.0'

export type WorkerModule = '@skmtc/core/worker' | '@skmtc/worker'

const CORE_PREFIX = 'jsr:@skmtc/core@'

/**
 * A generator's `@skmtc/core` requirement. `exact` is `true` for an exact
 * pin (`0.38.0`), which only that version satisfies; a caret range
 * (`^0.38.0`) accepts any later patch of the same minor.
 */
export type CoreRequirement = {
  version: string
  exact: boolean
}

/** Reads a `jsr:@skmtc/core@…` import value, or `null` for anything else. */
export const toCoreRequirement = (importValue: string | undefined): CoreRequirement | null => {
  if (importValue === undefined || !importValue.startsWith(CORE_PREFIX)) {
    return null
  }

  const range = importValue.slice(CORE_PREFIX.length)
  const exact = !range.startsWith('^')
  const version = range.replace(/^\^/, '')

  return tryParse(version) === undefined ? null : { version, exact }
}

/**
 * The module `worker.ts` imports `toWorker` from. A local core (any
 * non-`jsr:` specifier, such as a checkout path) is taken to be current.
 */
export const toWorkerModule = (corePin: string | undefined): WorkerModule => {
  if (corePin === undefined) {
    return '@skmtc/worker'
  }

  if (!corePin.startsWith(CORE_PREFIX)) {
    return '@skmtc/core/worker'
  }

  const requirement = toCoreRequirement(corePin)
  const version = requirement === null ? undefined : tryParse(requirement.version)
  const first = tryParse(FIRST_CORE_WITH_WORKER)

  if (version === undefined || first === undefined) {
    return '@skmtc/worker'
  }

  return greaterOrEqual(version, first) ? '@skmtc/core/worker' : '@skmtc/worker'
}

type SatisfiesArgs = {
  projectVersion: string
  requirement: CoreRequirement
}

/** Whether the project's exact core pin resolves the one core the generator needs. */
const satisfies = ({ projectVersion, requirement }: SatisfiesArgs): boolean => {
  if (requirement.exact) {
    return projectVersion === requirement.version
  }

  const project = tryParse(projectVersion)
  const needed = tryParse(requirement.version)

  if (project === undefined || needed === undefined) {
    return false
  }

  return (
    project.major === needed.major && project.minor === needed.minor && greaterOrEqual(project, needed)
  )
}

/** How many `@skmtc/worker` versions, newest first, {@link findWorkerVersionForCore} reads. */
const WORKER_SEARCH_LIMIT = 40

type WorkerMeta = {
  versions: Record<string, { yanked?: boolean }>
}

const isWorkerMeta = (value: unknown): value is WorkerMeta =>
  typeof value === 'object' &&
  value !== null &&
  'versions' in value &&
  typeof value.versions === 'object' &&
  value.versions !== null

/**
 * The newest published `@skmtc/worker` version that runs on `coreVersion`,
 * for a stack whose core predates `@skmtc/core/worker`. The CLI's own
 * worker pin follows the CLI's core, so it can't serve a stack on another
 * core. `null` when no recent worker version matches.
 */
export const findWorkerVersionForCore = async (coreVersion: string): Promise<string | null> => {
  const metaUrl = toJsrUrl('@skmtc/worker/meta.json')
  const metaResponse = await fetch(metaUrl)

  if (!metaResponse.ok) {
    await metaResponse.body?.cancel()
    throw new Error(`Could not read ${metaUrl}: ${metaResponse.status} ${metaResponse.statusText}.`)
  }

  const meta: unknown = await metaResponse.json()

  if (!isWorkerMeta(meta)) {
    throw new Error(`${metaUrl} does not list versions.`)
  }

  const candidates = Object.entries(meta.versions)
    .filter(([, info]) => info.yanked !== true)
    .map(([version]) => ({ version, parsed: tryParse(version) }))
    .flatMap(({ version, parsed }) => (parsed === undefined ? [] : [{ version, parsed }]))
    .sort((a, b) => compare(b.parsed, a.parsed))
    .slice(0, WORKER_SEARCH_LIMIT)

  for (const { version } of candidates) {
    const requirement = await readPublishedCoreRequirement({
      scopeName: '@skmtc',
      packageName: 'worker',
      version
    })

    if (requirement !== null && satisfies({ projectVersion: coreVersion, requirement })) {
      return version
    }
  }

  return null
}

type ReadPublishedCoreArgs = {
  scopeName: string
  packageName: string
  version: string
}

/**
 * The `@skmtc/core` requirement of one published generator version, read
 * from its `deno.json` on the registry. `null` when the generator does not
 * import core directly.
 */
export const readPublishedCoreRequirement = async ({
  scopeName,
  packageName,
  version
}: ReadPublishedCoreArgs): Promise<CoreRequirement | null> => {
  const url = toJsrUrl(`${scopeName}/${packageName}/${version}/deno.json`)
  const response = await fetch(url)

  if (!response.ok) {
    await response.body?.cancel()
    throw new Error(
      `Could not read the deno.json of ${scopeName}/${packageName}@${version} at ${url}: ` +
        `${response.status} ${response.statusText}.`
    )
  }

  return toCoreRequirementFromDenoJson(await response.json())
}

/** The `@skmtc/core` requirement in a parsed `deno.json`, or `null`. */
export const toCoreRequirementFromDenoJson = (denoJson: unknown): CoreRequirement | null => {
  if (typeof denoJson !== 'object' || denoJson === null || !('imports' in denoJson)) {
    return null
  }

  const { imports } = denoJson

  if (typeof imports !== 'object' || imports === null || !('@skmtc/core' in imports)) {
    return null
  }

  const corePin = imports['@skmtc/core']

  return typeof corePin === 'string' ? toCoreRequirement(corePin) : null
}

type CoreConflictErrorArgs = {
  generatorId: string
  requirement: CoreRequirement
  projectCorePin: string
  otherGeneratorIds: string[]
}

/**
 * A generator needs a different `@skmtc/core` from the one the project's
 * other generators run on. One bundle can hold only one core, so the
 * install or clone stops before it changes `deno.json`.
 */
export class CoreConflictError extends Error {
  constructor({ generatorId, requirement, projectCorePin, otherGeneratorIds }: CoreConflictErrorArgs) {
    const needs = requirement.exact ? requirement.version : `^${requirement.version}`
    super(
      `${generatorId} needs @skmtc/core ${needs}, but this project pins "${projectCorePin}" ` +
        `for ${otherGeneratorIds.join(', ')}. One project runs one core. Install a version of ` +
        `${generatorId} built on the project's core, or move ${otherGeneratorIds.join(', ')} to ` +
        `versions on core ${needs} first.`
    )
    this.name = 'CoreConflictError'
  }
}

type ReconcileCorePinArgs = {
  denoJson: RootDenoJson
  generatorId: string
  requirement: CoreRequirement | null
}

/**
 * Sets the project's `@skmtc/core` pin from a generator being added.
 *
 * - No requirement (the generator does not import core): no change.
 * - No pin yet, or a pin that already satisfies it: pin the requirement
 *   when there is none; otherwise keep the pin.
 * - A pin that does not satisfy it and no other generators: the pin came
 *   from an earlier default, so replace it (and drop a stale
 *   `@skmtc/worker` pin, which is chosen again from the new core).
 * - Otherwise: throw {@link CoreConflictError} naming the generators.
 */
export const reconcileCorePin = ({ denoJson, generatorId, requirement }: ReconcileCorePinArgs) => {
  if (requirement === null) {
    return
  }

  const projectCorePin = denoJson.contents.imports?.['@skmtc/core']
  const projectRequirement = toCoreRequirement(projectCorePin)

  if (projectCorePin === undefined) {
    denoJson.addImport('@skmtc/core', `${CORE_PREFIX}${requirement.version}`)
    return
  }

  // A non-jsr pin is a local override; the user owns it.
  if (projectRequirement === null) {
    return
  }

  if (satisfies({ projectVersion: projectRequirement.version, requirement })) {
    return
  }

  const otherGeneratorIds = denoJson.toGeneratorIds().filter(id => id !== generatorId)

  if (otherGeneratorIds.length > 0) {
    throw new CoreConflictError({ generatorId, requirement, projectCorePin, otherGeneratorIds })
  }

  denoJson.addImport('@skmtc/core', `${CORE_PREFIX}${requirement.version}`)
  denoJson.removeImport('@skmtc/worker')
}
