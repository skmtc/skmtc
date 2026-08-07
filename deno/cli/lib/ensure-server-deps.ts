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
 * Versions come from the CLI's own deno.json, consistent with
 * `ensureWorkerDeps`. The two pins are maintained differently:
 *
 *  - `@skmtc/server` is a JSR pin the CLI OWNS. Nothing but the
 *    generated `server.ts` imports it, and that file is rewritten from
 *    the CLI's own template on every publish — so a stale JSR pin in an
 *    already-initialized project is repinned to the CLI's version. It
 *    has to be: an entry emitted by a newer CLI can import a symbol an
 *    older `@skmtc/server` does not export, and the project fails at
 *    module load with "does not provide an export named …".
 *  - `@skmtc/core` is SHARED with the project's generator source, which
 *    may pin a version deliberately, so it is only added when absent.
 *    `skmtc doctor` warns on core-pin skew rather than rewriting it.
 *
 * A non-JSR pin (a local-checkout override such as `../server/mod.ts`)
 * is never overwritten either way.
 *
 * Returns `true` if any pin was added or updated.
 */
export const ensureServerDeps = (rootDenoJson: RootDenoJson): boolean => {
  let changed = false

  const readPin = (packageName: string): string | undefined => {
    const pin = rootDenoJson.contents.imports?.[packageName]
    return typeof pin === 'string' ? pin : undefined
  }

  const ensurePin = (packageName: string, version: string | null) => {
    if (version === null) return
    if (readPin(packageName) !== undefined) return
    rootDenoJson.addImport(packageName, `jsr:${packageName}@${version}`)
    changed = true
  }

  /** Add the pin when absent, and repin it when it names a different JSR
   *  version than the CLI's. A local-checkout override is left alone. */
  const ensureCurrentPin = (packageName: string, version: string | null) => {
    if (version === null) return
    const current = readPin(packageName)
    const wanted = `jsr:${packageName}@${version}`
    if (current === wanted) return
    if (current !== undefined && !current.startsWith(`jsr:${packageName}@`)) {
      return
    }
    rootDenoJson.addImport(packageName, wanted)
    changed = true
  }

  ensureCurrentPin('@skmtc/server', readCliServerPin())
  ensurePin('@skmtc/core', readCliCorePin())

  return changed
}
