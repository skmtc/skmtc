import type { RootDenoJson } from '@/lib/root-deno-json.ts'
import { readCliCorePin, readCliWorkerPin } from '@/lib/doctor-headless.ts'
import { toWorkerModule } from '@/lib/stack-core.ts'

/**
 * Ensure a project's deno.json pins what the CLI-generated `worker.ts`
 * imports, so it bundles:
 *
 *  - `@skmtc/core` — the generator stack decides it (#333): `install` and
 *    `clone` pin the core each generator needs. The CLI's own core is only
 *    the fallback for a project that has no pin yet, such as one whose
 *    generators are all local.
 *  - `@skmtc/worker` — only for a project whose core predates
 *    `@skmtc/core/worker`. A current core ships the worker entry, so
 *    `worker.ts` imports it from the project's core and no worker pin is
 *    needed.
 *
 * Pins are added only when **absent** — an existing pin (e.g. a
 * local-checkout override) is never overwritten.
 *
 * Returns `true` if any pin was added.
 */
export const ensureWorkerDeps = (rootDenoJson: RootDenoJson): boolean => {
  const ensurePin = (packageName: string, version: string | null): boolean => {
    if (version === null) return false
    if (rootDenoJson.contents.imports?.[packageName] !== undefined) return false
    rootDenoJson.addImport(packageName, `jsr:${packageName}@${version}`)
    return true
  }

  const addedCore = ensurePin('@skmtc/core', readCliCorePin())

  const workerModule = toWorkerModule(rootDenoJson.contents.imports?.['@skmtc/core'])
  const addedWorker = workerModule === '@skmtc/worker' && ensurePin('@skmtc/worker', readCliWorkerPin())

  return addedCore || addedWorker
}
