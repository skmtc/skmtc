import type { RootDenoJson } from '@/lib/root-deno-json.ts'
import { readCliCorePin, readCliServerPin } from '@/lib/doctor-headless.ts'

/**
 * Ensure a project's deno.json pins the peer packages that the
 * CLI-generated `server.ts` (the CF-Workers entry built by
 * `skmtc publish`) needs in order to bundle:
 *
 *  - `@skmtc/server` — `server.ts` does `import { createServer } from
 *    '@skmtc/server'`. Like `@skmtc/worker` for the Deno-Worker path,
 *    it is referenced by the CLI-generated entry and not by any
 *    cloned generator's source, so the clone import-collector never
 *    sees it.
 *  - `@skmtc/core` — the generator source and `@skmtc/server` both
 *    import it. Pinning a matching version here avoids the
 *    two-copies-in-bundle hazard if a generator pins an older core.
 *
 * Pins are added only when **absent** — an existing pin (e.g. a
 * local-checkout override) is never overwritten. Versions come from
 * the CLI's own deno.json, consistent with `ensureWorkerDeps`.
 *
 * Returns `true` if any pin was added.
 */
export const ensureServerDeps = (rootDenoJson: RootDenoJson): boolean => {
  let changed = false

  const ensurePin = (packageName: string, version: string | null) => {
    if (version === null) return
    if (rootDenoJson.contents.imports?.[packageName] !== undefined) return
    rootDenoJson.addImport(packageName, `jsr:${packageName}@${version}`)
    changed = true
  }

  ensurePin('@skmtc/server', readCliServerPin())
  ensurePin('@skmtc/core', readCliCorePin())

  return changed
}
