/**
 * Deno's minimum-dependency-age gate, in one place.
 *
 * From Deno 2.9 the runtime refuses to resolve a dependency version
 * published within the last 24 hours (a supply-chain measure). Every
 * `@skmtc/*` package publishes on merge to main, so a just-released
 * version ALWAYS sits inside that window — and the gate has three
 * different faces:
 *
 *  - an EXACT pin (what `ensureServerDeps` / `ensureWorkerDeps` write, and
 *    what a project's `deno.json` carries) is a hard error naming the
 *    policy on Deno ≥ 2.9.3, and on 2.9.0–2.9.2 the misleading
 *    `Do not know how to load path: deno:jsr:…`;
 *  - an UNPINNED specifier (`deno install jsr:@skmtc/cli`) resolves
 *    SILENTLY to the previous version — the install reports success and
 *    the older CLI runs;
 *  - a lockfile already holding the older resolution keeps it, so
 *    clearing the lock without also passing the flag lands right back on
 *    the older version.
 *
 * Anything that shells out to `deno` on the CLI's behalf passes
 * {@link toDependencyAgeArgs}, and anything that PRINTS a `deno` command
 * for someone to run builds it through {@link toCliInstallCommand} — a
 * remediation without the flag sends the reader back to the version they
 * are trying to leave.
 */

/** The flag as `deno` spells it. `0` disables the holdback outright. */
export const DEPENDENCY_AGE_FLAG = '--minimum-dependency-age=0'

/** Deno's default holdback window, for messages that explain the wait. */
export const DEPENDENCY_AGE_WINDOW_HOURS = 24

/**
 * Does this Deno understand the flag? It parses from 2.6 (a no-op until
 * the 2.9 gate) and is an unknown-argument error on ≤ 2.5. Callers pass
 * the running version because a subprocess resolves `deno` from PATH —
 * the same binary running this code in the supported setups.
 */
export const supportsDependencyAgeFlag = (
  denoVersion: string = Deno.version.deno
): boolean => {
  const [major, minor] = denoVersion.split('.').map(Number)
  if (Number.isNaN(major) || Number.isNaN(minor)) return false
  return major > 2 || (major === 2 && minor >= 6)
}

/**
 * Does this Deno actually ENFORCE the holdback? Two different versions
 * matter and conflating them produces wrong advice: the flag parses from
 * 2.6, but nothing is held back until 2.9. Below that there is no gate
 * to explain, so a "your release is too new to install" hint would name
 * a cause that does not exist.
 */
export const enforcesDependencyAgeGate = (
  denoVersion: string = Deno.version.deno
): boolean => {
  const [major, minor] = denoVersion.split('.').map(Number)
  if (Number.isNaN(major) || Number.isNaN(minor)) return false
  return major > 2 || (major === 2 && minor >= 9)
}

/** Args to splice into a `deno` subprocess invocation, empty when the
 *  running Deno predates the flag. */
export const toDependencyAgeArgs = (denoVersion?: string): string[] =>
  supportsDependencyAgeFlag(denoVersion) ? [DEPENDENCY_AGE_FLAG] : []

/**
 * The reinstall command the CLI hands out — `skmtc doctor`'s hints and
 * the how-to docs print this one string, so the flag cannot drift out of
 * a remediation again.
 */
export const toCliInstallCommand = (denoVersion?: string): string =>
  [
    'deno install -gAf',
    ...toDependencyAgeArgs(denoVersion),
    '--unstable-worker-options --name skmtc jsr:@skmtc/cli'
  ].join(' ')

/**
 * `deno install` for a PROJECT directory — the one `skmtc publish` tells
 * you to run when the upload has no `deno.lock`. That directory's
 * `deno.json` carries the exact `@skmtc/*` pins `ensureWorkerDeps` /
 * `ensureServerDeps` wrote at the CLI's own version, so on a CLI
 * released minutes ago it is the hard-error face of the gate: without
 * the flag, the recovery instruction reproduces the failure.
 */
export const toProjectInstallCommand = (denoVersion?: string): string =>
  ['deno install', ...toDependencyAgeArgs(denoVersion)].join(' ')

/** Hours since `publishedAt`, or `undefined` when the registry did not
 *  report a publish time. */
export const toHoursSincePublish = (
  publishedAt: string | undefined,
  now: Date = new Date()
): number | undefined => {
  if (publishedAt === undefined) return undefined
  const published = new Date(publishedAt)
  if (Number.isNaN(published.getTime())) return undefined
  return (now.getTime() - published.getTime()) / (1000 * 60 * 60)
}

/**
 * Is this version still inside Deno's holdback window — i.e. will a
 * resolution without the flag refuse to reach it?
 *
 * A NEGATIVE age counts as inside. A publish time slightly ahead of the
 * local clock (a lagging machine, a registry timestamp a moment ahead)
 * means the release just landed, which is the deepest part of the window
 * — reading it as "outside" would drop the explanation in the one case
 * the check exists for.
 */
export const isWithinDependencyAgeWindow = (
  publishedAt: string | undefined,
  now?: Date
): boolean => {
  const hours = toHoursSincePublish(publishedAt, now)
  return hours !== undefined && hours < DEPENDENCY_AGE_WINDOW_HOURS
}
