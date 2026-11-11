import type { RootDenoJson } from '@/lib/root-deno-json.ts'
import { readCliCorePin } from '@/lib/doctor-headless.ts'
import {
  applyCorePlan,
  FIRST_CORE_WITH_WORKER,
  findWorkerVersionForCore,
  planCorePin,
  readInstalledRequirements,
  toCorePin,
  toLocalCoreWorkerPath,
  toWorkerModule
} from '@/lib/stack-core.ts'

/**
 * Ensure a project's deno.json pins what the CLI-generated `worker.ts`
 * imports, so it bundles. Pins are added only when **absent** — an
 * existing pin (e.g. a local-checkout override) is never overwritten.
 *
 *  - `@skmtc/core` — the generator stack decides it (#333). With no pin,
 *    the project gets the one core every installed generator accepts; the
 *    CLI's own core is the fallback only when no generator names a core.
 *  - `@skmtc/core/worker` — for a local core checkout that exports
 *    `./worker`, since an import-map entry that points at a file resolves
 *    no subpaths.
 *  - `@skmtc/worker` — only for a stack on a core older than
 *    `@skmtc/core/worker`: the newest published worker built on that core.
 *
 * Returns `true` if any pin was added.
 */
export const ensureWorkerDeps = async (rootDenoJson: RootDenoJson): Promise<boolean> => {
  const addedCore = await ensureCorePin(rootDenoJson)
  const addedCoreWorker = await ensureLocalCoreWorker(rootDenoJson)
  const addedWorker = ensureWorkerPin(rootDenoJson)

  return addedCore || addedCoreWorker || addedWorker
}

const ensureCorePin = async (rootDenoJson: RootDenoJson): Promise<boolean> => {
  if (rootDenoJson.contents.imports?.['@skmtc/core'] !== undefined) {
    return false
  }

  const plan = planCorePin({
    current: undefined,
    requirements: await readInstalledRequirements({ denoJson: rootDenoJson })
  })

  if (plan.type !== 'keep') {
    applyCorePlan({ denoJson: rootDenoJson, plan })
    return true
  }

  const cliCorePin = readCliCorePin()

  if (cliCorePin === null) {
    return false
  }

  rootDenoJson.addImport('@skmtc/core', `jsr:@skmtc/core@${cliCorePin}`)
  return true
}

const ensureLocalCoreWorker = async (rootDenoJson: RootDenoJson): Promise<boolean> => {
  const value = rootDenoJson.contents.imports?.['@skmtc/core']

  if (value === undefined || rootDenoJson.contents.imports?.['@skmtc/core/worker'] !== undefined) {
    return false
  }

  const pin = toCorePin(value)

  if (pin.type !== 'local') {
    return false
  }

  const workerPath = await toLocalCoreWorkerPath({ denoJson: rootDenoJson, corePath: pin.path })

  if (workerPath === null) {
    return false
  }

  rootDenoJson.addImport('@skmtc/core/worker', workerPath)
  return true
}

const ensureWorkerPin = (rootDenoJson: RootDenoJson): boolean => {
  const imports = rootDenoJson.contents.imports

  if (toWorkerModule(imports) === '@skmtc/core/worker' || imports?.['@skmtc/worker'] !== undefined) {
    return false
  }

  const value = imports?.['@skmtc/core']
  const pin = value === undefined ? undefined : toCorePin(value)

  if (pin?.type !== 'exact') {
    throw new Error(
      `Project "${rootDenoJson.projectName}" pins @skmtc/core as "${value}", so the CLI can't tell ` +
        `which @skmtc/worker runs on it. Pin an exact version ("jsr:@skmtc/core@x.y.z"), ` +
        `or add "@skmtc/worker" to the project's deno.json imports.`
    )
  }

  const workerVersion = findWorkerVersionForCore(pin.version)

  if (workerVersion === null) {
    throw new Error(
      `No published @skmtc/worker runs on @skmtc/core ${pin.version}, the core this project's ` +
        `generators pin. Add "@skmtc/worker" to the project's deno.json imports, or move the ` +
        `generators to a core that ships @skmtc/core/worker (${FIRST_CORE_WITH_WORKER} or later).`
    )
  }

  rootDenoJson.addImport('@skmtc/worker', `jsr:@skmtc/worker@${workerVersion}`)
  return true
}
