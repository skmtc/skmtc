/**
 * Headless `doctor` — active diagnostics for the most common
 * agent-affecting failure modes. Walks a fixed checklist and reports
 * each check as `ok | warning | error | skipped` with a hint.
 *
 * Designed so an agent can run `skmtc doctor --json` as the first
 * step when something's off; the structured output points at the
 * specific friction to address (peer-dep skew, missing bundle,
 * malformed manifest, etc.) without having to read stack traces.
 */

import { join } from '@std/path/join'
import { isAbsolute } from '@std/path/is-absolute'
import { existsSync } from '@std/fs/exists'
import * as v from 'valibot'
import { manifestContent } from '@skmtc/core/Manifest'
import { expandClientJson } from '@skmtc/core/ClientJsonCompact'
import { toRootPath } from '@/lib/to-root-path.ts'
import { toProjectPath } from '@/lib/to-project-path.ts'
import { toBundleFsPath } from '@/lib/to-bundle-path.ts'
import { Manifest } from '@/lib/manifest.ts'
import { homedir } from 'node:os'
import cliDenoJson from '../deno.json' with { type: 'json' }
import {
  checkAnchorsConfig,
  checkAnchorsCoverage,
  checkAnchorsStaleness
} from '@/lib/doctor-anchors.ts'
import { maskToken, readStoredAuth, toAuthFilePath } from '@/lib/hub-token.ts'

export type CheckStatus = 'ok' | 'warning' | 'error' | 'skipped'

export type Check = {
  id: string
  status: CheckStatus
  message: string
  hint?: string
  /**
   * Optional structured data for agents that want to act on the
   * check programmatically (e.g. open the file at this path, run
   * this remediation command). Shape varies per check id; agents
   * should branch on `id` before reading.
   */
  data?: Record<string, unknown>
}

export type DoctorResult = {
  skmtcRootPath: string
  globalStateDir: string
  cliVersion: string
  projects: string[]
  checks: Check[]
  /**
   * Aggregate of `checks.status` — `ok` only when every check is
   * `ok` or `skipped`. Agents can branch on this without re-walking
   * the array.
   */
  summary: CheckStatus
}

type RunDoctorArgs = {
  /**
   * The CLI's own version string — caller passes it in (read from
   * `cli/deno.json`) so this lib has no path coupling to the
   * package manifest.
   */
  cliVersion: string
  /**
   * The running Deno version. Defaults to `Deno.version.deno`;
   * injectable so tests can exercise the version-floor check.
   */
  denoVersion?: string
}

export const runDoctor = async ({
  cliVersion,
  denoVersion = Deno.version.deno
}: RunDoctorArgs): Promise<DoctorResult> => {
  const skmtcRootPath = toRootPath()
  const globalStateDir = join(homedir(), '.skmtc')
  const projects = listProjects(skmtcRootPath)
  const checks: Check[] = []

  checks.push(checkInstallLockfile())
  checks.push(checkDenoVersion(denoVersion))
  checks.push(checkHubAuth())

  const cliCorePin = readCliCorePin()
  const projectCtx: CheckProjectContext = { cliCorePin }
  for (const project of projects) {
    checks.push(...checkProject(project, projectCtx))
  }

  return {
    skmtcRootPath,
    globalStateDir,
    cliVersion,
    projects,
    checks,
    summary: aggregate(checks)
  }
}

const listProjects = (skmtcRootPath: string): string[] => {
  if (!existsSync(skmtcRootPath)) return []
  try {
    return Array.from(Deno.readDirSync(skmtcRootPath))
      .filter(entry => entry.isDirectory)
      .map(entry => entry.name)
      .sort()
  } catch {
    return []
  }
}

const aggregate = (checks: Check[]): CheckStatus => {
  if (checks.some(c => c.status === 'error')) return 'error'
  if (checks.some(c => c.status === 'warning')) return 'warning'
  return 'ok'
}

/**
 * Friction #16: the lockfile of the globally-installed `skmtc` CLI,
 * at `~/.deno/bin/.skmtc/deno.lock`, silently pins an old CLI/core
 * version even when `deno install -f` is rerun. We can't fix Deno's
 * behavior from here, but we can detect the situation and tell the
 * operator how to clear it.
 */
const checkInstallLockfile = (): Check => {
  const lockPath = join(homedir(), '.deno', 'bin', '.skmtc', 'deno.lock')
  if (!existsSync(lockPath)) {
    return {
      id: 'install-lockfile',
      status: 'skipped',
      message: `No install lockfile at ${lockPath} — not a deno-install setup.`
    }
  }

  try {
    const content = Deno.readTextFileSync(lockPath)
    const coreVersion = extractPin(content, /jsr:@skmtc\/core@([\d.^~<>=*]+)/)
    const cliVersion = extractPin(content, /jsr:@skmtc\/cli@([\d.^~<>=*]+)/)

    return {
      id: 'install-lockfile',
      status: 'ok',
      message: `Install lockfile present. Pinned: @skmtc/cli=${cliVersion ?? 'unknown'}, @skmtc/core=${coreVersion ?? 'unknown'}.`,
      hint:
        `If enrichment leaves arrive as \`{}\` inside generators, your installed ` +
        `CLI might be pinned to an old @skmtc/core. Remediation: ` +
        `\`rm -f ${lockPath} && deno install -gAf --unstable-worker-options --name skmtc jsr:@skmtc/cli\`. ` +
        `See friction #16 in skmtc-cli skill §7.`,
      data: { lockPath, cliVersion, coreVersion }
    }
  } catch (error) {
    return {
      id: 'install-lockfile',
      status: 'warning',
      message: `Couldn't read install lockfile at ${lockPath}: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

const extractPin = (content: string, pattern: RegExp): string | null => {
  const match = content.match(pattern)
  return match?.[1] ?? null
}

/**
 * Offline shape check of the stored hub credential
 * (`~/.skmtc/auth.json`, written by `skmtc login`). No network call —
 * `skmtc login` is the place that validates the token against the
 * hub. Never includes token material beyond the last 4 characters.
 */
const checkHubAuth = (): Check => {
  const authPath = toAuthFilePath()

  if (!existsSync(authPath)) {
    return {
      id: 'hub-auth',
      status: 'skipped',
      message: `No stored hub credential at ${authPath} — \`skmtc login\` stores one (publish also accepts --token / $SKMTC_HUB_TOKEN).`
    }
  }

  const stored = readStoredAuth()

  if (stored === null) {
    return {
      id: 'hub-auth',
      status: 'warning',
      message: `${authPath} exists but is not the expected { host, token } shape.`,
      hint: 'Run `skmtc logout` to delete it, then `skmtc login` to store a fresh token.',
      data: { authPath }
    }
  }

  return {
    id: 'hub-auth',
    status: 'ok',
    message: `Stored hub credential for ${stored.host} (token ${maskToken(stored.token)}).`,
    data: { authPath, host: stored.host }
  }
}

/**
 * `createBundle` runs `deno bundle -o` — the esbuild-based `deno
 * bundle` re-introduced in Deno 2.4.0. On older Deno the subcommand
 * is absent or rejects `-o`, and the failure surfaces as a generic
 * "Failed to create bundle". Flag a too-old runtime up front.
 */
const checkDenoVersion = (denoVersion: string): Check => {
  const [major = 0, minor = 0] = denoVersion.split('.').map(part => parseInt(part, 10) || 0)
  const satisfiesFloor = major > 2 || (major === 2 && minor >= 4)

  if (satisfiesFloor) {
    return {
      id: 'deno-version',
      status: 'ok',
      message: `Deno ${denoVersion} satisfies the >= 2.4.0 floor for \`deno bundle\`.`,
      data: { denoVersion }
    }
  }

  return {
    id: 'deno-version',
    status: 'warning',
    message: `Deno ${denoVersion} is below 2.4.0 — \`skmtc bundle\` needs the esbuild-based \`deno bundle\` re-introduced in 2.4.0.`,
    hint: `Upgrade Deno with \`deno upgrade\`.`,
    data: { denoVersion }
  }
}

type CheckProjectContext = {
  /**
   * `@skmtc/core` semver constraint declared by the CLI itself (from
   * `cli/deno.json#imports['@skmtc/core']`). Used to flag projects
   * pinning an incompatible core version — friction #7. Passed in
   * from `runDoctor` rather than re-read per check.
   */
  cliCorePin: string | null
}

const checkProject = (
  projectName: string,
  ctx: CheckProjectContext
): Check[] => {
  const projectPath = toProjectPath(projectName)
  const denoJsonPath = join(projectPath, 'deno.json')
  const clientJsonPath = join(projectPath, '.settings', 'client.json')
  const bundlePath = toBundleFsPath(projectPath)

  const checks: Check[] = []
  checks.push(checkProjectDenoJson(projectName, denoJsonPath))
  checks.push(checkProjectBasePath(projectName, clientJsonPath))
  checks.push(checkProjectCorePin(projectName, denoJsonPath, ctx.cliCorePin))
  checks.push(checkProjectBundle(projectName, denoJsonPath, bundlePath))
  checks.push(checkProjectWorkerPin(projectName, denoJsonPath, join(projectPath, 'worker.ts')))
  checks.push(checkProjectManifest(projectName))
  // Gen-maps (anchors) checks — all three short-circuit to `skipped`
  // when the project hasn't opted in, so they're free for users not
  // using the feature.
  checks.push(checkAnchorsConfig(projectName, projectPath))
  checks.push(checkAnchorsCoverage(projectName, projectPath))
  checks.push(checkAnchorsStaleness(projectName, projectPath))
  return checks
}

/**
 * Reads the CLI's own `@skmtc/core` semver pin from
 * `cli/deno.json#imports`. Used to flag projects whose pin doesn't
 * satisfy the CLI's requirement.
 *
 * Returns `null` if the import map is unreadable or missing — that's
 * a separate failure that should surface elsewhere; from doctor's
 * perspective, a null pin means "skip the comparison".
 *
 * Imported via JSON module syntax so it's resolved at build time. We
 * don't go through `Deno.readTextFileSync(...)` because the path of
 * `cli/deno.json` depends on the install shape (compiled binary vs
 * deno run vs deno-install launcher) — JSON imports work uniformly.
 *
 * Exported so the pre-flight clone check can reuse it without
 * dragging in the full doctor scaffolding (friction #3 in the
 * follow-up: surface a peer-pin mismatch BEFORE downloading).
 */
export const readCliCorePin = (): string | null => {
  // The JSON import lives at the module top to avoid taking a hard
  // dependency on `cli/deno.json`'s shape inside the function body;
  // we only read the field we care about.
  const value = cliDenoJson?.imports?.['@skmtc/core']
  if (typeof value !== 'string') return null
  // Strip the `jsr:` prefix and the `@skmtc/core@` segment so we keep
  // just the version constraint (e.g. `^0.3.0`).
  const match = value.match(/^jsr:@skmtc\/core@(.+)$/)
  return match ? match[1] : null
}

/**
 * The CLI's own `@skmtc/worker` pin, read from `cli/deno.json`.
 * `@skmtc/worker` versions independently of `@skmtc/core`, so it
 * needs its own reader. Mirrors {@link readCliCorePin}; exported so
 * `ensureWorkerDeps` can pin a fresh project to the CLI's version.
 */
export const readCliWorkerPin = (): string | null => {
  const value = cliDenoJson?.imports?.['@skmtc/worker']
  if (typeof value !== 'string') return null
  const match = value.match(/^jsr:@skmtc\/worker@(.+)$/)
  return match ? match[1] : null
}

/**
 * The CLI's own `@skmtc/server` pin, read from `cli/deno.json`.
 * `@skmtc/server` is the Hono wrapper bundled into the CF-Workers
 * `server.js` artifact by `skmtc publish`. Exported so
 * `ensureServerDeps` can pin a fresh project to the CLI's version.
 */
export const readCliServerPin = (): string | null => {
  const value = cliDenoJson?.imports?.['@skmtc/server']
  if (typeof value !== 'string') return null
  const match = value.match(/^jsr:@skmtc\/server@(.+)$/)
  return match ? match[1] : null
}

/**
 * Compares a project's `@skmtc/core` pin to the CLI's own. Friction
 * #7: stale per-project `deno.json` templates pin old core versions
 * that mismatch the bundle's expectations, producing cryptic
 * `No matching export … "SnippetBase"` errors at bundle time.
 *
 * Comparison is intentionally coarse — we surface a warning when the
 * declared major.minor differ, treating patch-level differences as
 * acceptable. Anything more elaborate would require a full semver
 * resolver, which is overkill for a diagnostic check.
 */
const checkProjectCorePin = (
  projectName: string,
  denoJsonPath: string,
  cliCorePin: string | null
): Check => {
  if (cliCorePin === null) {
    return {
      id: `project-core-pin/${projectName}`,
      status: 'skipped',
      message: `Could not read the CLI's own @skmtc/core pin; comparison skipped.`
    }
  }
  if (!existsSync(denoJsonPath)) {
    return {
      id: `project-core-pin/${projectName}`,
      status: 'skipped',
      message: `Project "${projectName}" has no deno.json; core-pin check skipped.`
    }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(Deno.readTextFileSync(denoJsonPath))
  } catch {
    return {
      id: `project-core-pin/${projectName}`,
      status: 'skipped',
      message: `Project "${projectName}" deno.json unparseable; core-pin check skipped.`
    }
  }
  const projectCoreValueRaw =
    parsed && typeof parsed === 'object' && 'imports' in parsed
      ? (parsed as { imports?: Record<string, unknown> }).imports?.['@skmtc/core']
      : undefined
  if (typeof projectCoreValueRaw !== 'string') {
    return {
      id: `project-core-pin/${projectName}`,
      status: 'warning',
      message: `Project "${projectName}" doesn't pin @skmtc/core in its deno.json.`,
      hint:
        `Add "@skmtc/core": "jsr:@skmtc/core@${cliCorePin}" under "imports". ` +
        `Without a pin, \`deno bundle\` resolves arbitrarily and you may hit ` +
        `peer-version skew (cryptic "No matching export" errors).`
    }
  }
  const projectMatch = projectCoreValueRaw.match(/^jsr:@skmtc\/core@(.+)$/)
  if (!projectMatch) {
    return {
      id: `project-core-pin/${projectName}`,
      status: 'warning',
      message: `Project "${projectName}" pins @skmtc/core via a non-JSR specifier: ${projectCoreValueRaw}.`,
      hint:
        `Doctor's heuristic only understands jsr: specifiers. If you intend ` +
        `a local override, that's fine — doctor just can't compare it.`
    }
  }
  const projectPin = projectMatch[1]
  const cliMajorMinor = toMajorMinor(cliCorePin)
  const projectMajorMinor = toMajorMinor(projectPin)
  if (cliMajorMinor === null || projectMajorMinor === null) {
    return {
      id: `project-core-pin/${projectName}`,
      status: 'warning',
      message: `Couldn't parse one or both @skmtc/core pins (cli: ${cliCorePin}, project: ${projectPin}); manual review required.`
    }
  }
  if (cliMajorMinor !== projectMajorMinor) {
    return {
      id: `project-core-pin/${projectName}`,
      status: 'warning',
      message: `Project "${projectName}" pins @skmtc/core ${projectPin}; the CLI uses ${cliCorePin}. Major.minor mismatch.`,
      hint:
        `Update the project's "@skmtc/core" pin to "jsr:@skmtc/core@${cliCorePin}" to match. ` +
        `Stale pins are the root cause of "No matching export … SnippetBase" errors at bundle time ` +
        `(friction #7 in skmtc-cli skill §6).`,
      data: { projectPin, cliCorePin }
    }
  }
  return {
    id: `project-core-pin/${projectName}`,
    status: 'ok',
    message: `Project "${projectName}" pins @skmtc/core ${projectPin}; CLI uses ${cliCorePin} (compatible).`
  }
}

/**
 * Extracts `major.minor` from a semver constraint like `^0.3.0` or
 * `~1.2.3` or `0.3`. Returns `null` for `*`, `latest`, anything we
 * can't parse — doctor degrades to "manual review" rather than
 * guessing.
 *
 * Exported alongside {@link readCliCorePin} so the pre-flight clone
 * check can use the same major.minor comparison heuristic doctor
 * uses (don't reinvent semver matching for two call sites).
 */
export const toMajorMinor = (constraint: string): string | null => {
  const match = constraint.match(/(\d+)\.(\d+)/)
  if (!match) return null
  return `${match[1]}.${match[2]}`
}

const checkProjectDenoJson = (projectName: string, denoJsonPath: string): Check => {
  if (!existsSync(denoJsonPath)) {
    return {
      id: `project-deno-json/${projectName}`,
      status: 'error',
      message: `Project "${projectName}" is missing ${denoJsonPath}.`,
      hint: 'Run `skmtc init` to scaffold the project state, or delete the directory if it was abandoned.'
    }
  }
  try {
    JSON.parse(Deno.readTextFileSync(denoJsonPath))
    return {
      id: `project-deno-json/${projectName}`,
      status: 'ok',
      message: `Project "${projectName}" has a parseable deno.json.`
    }
  } catch (error) {
    return {
      id: `project-deno-json/${projectName}`,
      status: 'error',
      message: `Project "${projectName}" deno.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}.`,
      hint: `Open ${denoJsonPath} and fix the syntax error, then re-run.`
    }
  }
}

const checkProjectBasePath = (projectName: string, clientJsonPath: string): Check => {
  if (!existsSync(clientJsonPath)) {
    return {
      id: `project-base-path/${projectName}`,
      status: 'warning',
      message: `Project "${projectName}" has no client.json — generate runs will need an explicit [schema] arg.`,
      hint: `Run \`skmtc init ${projectName} <basePath>\` to scaffold it.`
    }
  }
  try {
    const parsed: unknown = expandClientJson(JSON.parse(Deno.readTextFileSync(clientJsonPath)))
    const basePath: unknown = (parsed as { settings?: { basePath?: unknown } })?.settings?.basePath
    if (typeof basePath !== 'string') {
      return {
        id: `project-base-path/${projectName}`,
        status: 'warning',
        message: `Project "${projectName}" has client.json but no settings.basePath.`,
        hint: 'Set `settings.basePath` so generated files land in a known location. See the cli skill §1 mental-model table for the convention.'
      }
    }
    if (isAbsolute(basePath)) {
      // Friction #13 — absolute paths get concatenated onto the
      // SKMTC root. We can't auto-fix at runtime but we can flag it.
      return {
        id: `project-base-path/${projectName}`,
        status: 'error',
        message: `Project "${projectName}" has an absolute basePath: ${basePath}.`,
        hint: 'basePath must be relative to the SKMTC root. Edit client.json or re-run `skmtc init` with a relative path.'
      }
    }
    return {
      id: `project-base-path/${projectName}`,
      status: 'ok',
      message: `Project "${projectName}" basePath is "${basePath}".`,
      data: { basePath }
    }
  } catch (error) {
    return {
      id: `project-base-path/${projectName}`,
      status: 'error',
      message: `Project "${projectName}" client.json is unreadable: ${error instanceof Error ? error.message : String(error)}.`
    }
  }
}

const checkProjectBundle = (
  projectName: string,
  denoJsonPath: string,
  /** Filesystem path to the project's bundle.js (see `toBundleFsPath`). */
  bundlePath: string
): Check => {
  if (!existsSync(denoJsonPath)) {
    return {
      id: `project-bundle/${projectName}`,
      status: 'skipped',
      message: `Project "${projectName}" has no deno.json — bundle check skipped.`
    }
  }
  try {
    JSON.parse(Deno.readTextFileSync(denoJsonPath))
  } catch {
    return {
      id: `project-bundle/${projectName}`,
      status: 'skipped',
      message: `Project "${projectName}" deno.json is unparseable — bundle check skipped.`
    }
  }

  // Every project — remote-only included — generates from its local
  // bundle.js, so its absence is always actionable.
  if (!existsSync(bundlePath)) {
    return {
      id: `project-bundle/${projectName}`,
      status: 'warning',
      message: `Project "${projectName}" has no bundle.js at ${bundlePath}.`,
      hint: `Run \`skmtc bundle ${projectName}\` to build it.`,
      data: { bundlePath }
    }
  }
  return {
    id: `project-bundle/${projectName}`,
    status: 'ok',
    message: `Project "${projectName}" has a local bundle.js.`,
    data: { bundlePath }
  }
}

/**
 * `clone` once produced a project whose deno.json had only the
 * `@scope/gen-*` local mappings — the CLI-generated `worker.ts` does
 * `import toWorker from '@skmtc/worker'`, so without that pin
 * `deno bundle` fails with an unresolved-import error. `bundle` now
 * writes the pin via `ensureWorkerDeps`; this check surfaces a project
 * that predates that fix or had the pin removed. A project with no
 * `worker.ts` yet is ok-noop: the first `skmtc bundle` writes both
 * the worker and the pin.
 */
const checkProjectWorkerPin = (
  projectName: string,
  denoJsonPath: string,
  workerPath: string
): Check => {
  if (!existsSync(denoJsonPath)) {
    return {
      id: `project-worker-pin/${projectName}`,
      status: 'skipped',
      message: `Project "${projectName}" has no deno.json — worker-pin check skipped.`
    }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(Deno.readTextFileSync(denoJsonPath))
  } catch {
    return {
      id: `project-worker-pin/${projectName}`,
      status: 'skipped',
      message: `Project "${projectName}" deno.json is unparseable — worker-pin check skipped.`
    }
  }
  const imports = (parsed as { imports?: Record<string, unknown> })?.imports ?? {}

  if (!existsSync(workerPath)) {
    return {
      id: `project-worker-pin/${projectName}`,
      status: 'ok',
      message: `Project "${projectName}" has no worker.ts yet; the first \`skmtc bundle\` writes it along with the @skmtc/worker pin.`
    }
  }

  if (imports['@skmtc/worker'] === undefined) {
    return {
      id: `project-worker-pin/${projectName}`,
      status: 'warning',
      message: `Project "${projectName}" has no @skmtc/worker pin — the generated worker.ts will not bundle.`,
      hint: `Run \`skmtc bundle ${projectName}\` — it writes the pin automatically — or add "@skmtc/worker" to the project's deno.json imports.`
    }
  }

  return {
    id: `project-worker-pin/${projectName}`,
    status: 'ok',
    message: `Project "${projectName}" pins @skmtc/worker.`
  }
}

const checkProjectManifest = (projectName: string): Check => {
  const manifestPath = Manifest.toPath(projectName)
  if (!existsSync(manifestPath)) {
    return {
      id: `project-manifest/${projectName}`,
      status: 'skipped',
      message: `Project "${projectName}" has no manifest yet — run \`skmtc generate ${projectName}\` to produce one.`
    }
  }
  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(Deno.readTextFileSync(manifestPath))
  } catch (error) {
    return {
      id: `project-manifest/${projectName}`,
      status: 'warning',
      message: `Project "${projectName}" manifest.json is not valid JSON (${error instanceof Error ? error.message : String(error)}).`,
      hint:
        'Re-run `skmtc generate` to rewrite it. Stale/malformed manifests are tolerated at runtime ' +
        'but cleanup of previous artifacts will be skipped on this run.'
    }
  }
  const validated = v.safeParse(manifestContent, parsedJson)
  if (!validated.success) {
    // Friction #26: stale-schema manifest. At runtime the tolerant
    // reader degrades to null + warning, which is non-fatal — so
    // this is a `warning` not an `error` from doctor's perspective.
    const summary = validated.issues[0]?.message ?? 'schema mismatch'
    return {
      id: `project-manifest/${projectName}`,
      status: 'warning',
      message: `Project "${projectName}" manifest.json doesn't match the current @skmtc/core schema (${summary}).`,
      hint: 'Re-run `skmtc generate` to rewrite the manifest in the current shape.'
    }
  }
  return {
    id: `project-manifest/${projectName}`,
    status: 'ok',
    message: `Project "${projectName}" manifest.json is current.`
  }
}
