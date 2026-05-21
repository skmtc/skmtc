import type { RootDenoJson } from '@/lib/root-deno-json.ts'
import { readCliCorePin, readCliWorkerPin } from '@/lib/doctor-headless.ts'

/**
 * Ensure a project's deno.json pins the peer packages that the
 * CLI-generated `worker.ts` needs in order to bundle:
 *
 *  - `@skmtc/worker` — `worker.ts` does `import toWorker from
 *    '@skmtc/worker'`. It is imported by the CLI-generated worker, not
 *    by any cloned generator's source, so the `clone` import-collector
 *    never sees it and never adds it.
 *  - `@skmtc/core` — the generator source imports it.
 *
 * Pins are added only when **absent** — an existing pin (e.g. a
 * local-checkout override) is never overwritten. Versions come from
 * the CLI's own deno.json so the project tracks the CLI it was built
 * with, consistent with the `@skmtc/core` peer-pin check that `clone`
 * already enforces.
 *
 * Returns `true` if any pin was added.
 */
export const ensureWorkerDeps = (rootDenoJson: RootDenoJson): boolean => {
  let changed = false

  const ensurePin = (packageName: string, version: string | null) => {
    if (version === null) return
    if (rootDenoJson.contents.imports?.[packageName] !== undefined) return
    rootDenoJson.addImport(packageName, `jsr:${packageName}@${version}`)
    changed = true
  }

  ensurePin('@skmtc/worker', readCliWorkerPin())
  ensurePin('@skmtc/core', readCliCorePin())

  return changed
}
