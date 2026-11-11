import type { RootDenoJson } from '@/lib/root-deno-json.ts'
import { readCliCorePin, readCliWorkerPin, toMajorMinor } from '@/lib/doctor-headless.ts'
import {
  FIRST_CORE_WITH_WORKER,
  findWorkerVersionForCore,
  toCoreRequirement,
  toWorkerModule
} from '@/lib/stack-core.ts'

type EnsureWorkerDepsOptions = {
  /** Finds the `@skmtc/worker` version for an older core. Injected in tests. */
  findWorkerVersion?: (coreVersion: string) => Promise<string | null>
}

/**
 * Ensure a project's deno.json pins what the CLI-generated `worker.ts`
 * imports, so it bundles:
 *
 *  - `@skmtc/core` — the generator stack decides it (#333): `install` and
 *    `clone` pin the core each generator needs. The CLI's own core is only
 *    the fallback for a project that has no pin yet, such as one whose
 *    generators are all local.
 *  - `@skmtc/worker` — only for a project whose core predates
 *    `@skmtc/core/worker`. It must run on the project's core, so the CLI's
 *    own worker pin is used only when the CLI is on that core's minor;
 *    otherwise the newest published worker built on the project's core is
 *    pinned.
 *
 * Pins are added only when **absent** — an existing pin (e.g. a
 * local-checkout override) is never overwritten.
 *
 * Returns `true` if any pin was added.
 */
export const ensureWorkerDeps = async (
  rootDenoJson: RootDenoJson,
  { findWorkerVersion = findWorkerVersionForCore }: EnsureWorkerDepsOptions = {}
): Promise<boolean> => {
  const addPin = (packageName: string, version: string) => {
    rootDenoJson.addImport(packageName, `jsr:${packageName}@${version}`)
  }

  const cliCorePin = readCliCorePin()
  const hasCorePin = rootDenoJson.contents.imports?.['@skmtc/core'] !== undefined
  const addedCore = !hasCorePin && cliCorePin !== null

  if (addedCore) {
    addPin('@skmtc/core', cliCorePin)
  }

  const corePin = rootDenoJson.contents.imports?.['@skmtc/core']
  const needsWorkerPin =
    toWorkerModule(corePin) === '@skmtc/worker' &&
    rootDenoJson.contents.imports?.['@skmtc/worker'] === undefined

  if (!needsWorkerPin) {
    return addedCore
  }

  const projectCore = toCoreRequirement(corePin)
  const cliWorkerPin = readCliWorkerPin()
  const onCliCore =
    projectCore === null ||
    (cliCorePin !== null && toMajorMinor(projectCore.version) === toMajorMinor(cliCorePin))

  if (onCliCore) {
    if (cliWorkerPin === null) {
      return addedCore
    }
    addPin('@skmtc/worker', cliWorkerPin)
    return true
  }

  const workerVersion = await findWorkerVersion(projectCore.version)

  if (workerVersion === null) {
    throw new Error(
      `No published @skmtc/worker runs on @skmtc/core ${projectCore.version}, the core this ` +
        `project's generators pin. Add "@skmtc/worker" to the project's deno.json imports, ` +
        `or move the generators to a core that ships @skmtc/core/worker ` +
        `(${FIRST_CORE_WITH_WORKER} or later).`
    )
  }

  addPin('@skmtc/worker', workerVersion)
  return true
}
