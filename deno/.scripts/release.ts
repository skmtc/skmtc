#!/usr/bin/env -S deno run --allow-read --allow-write --allow-env --allow-net --allow-run
/**
 * Release: cascade workspace version bumps down the dependency tree
 * and publish to the JSR registry.
 *
 * The registry is the single source of truth for what is published;
 * each package's `deno.json` is the source of truth for its version.
 * There is no local state file — that was a cache that drifted out of
 * sync and became a source of confusion.
 *
 * Flow:
 *   1. You bump the `version` of each package you directly changed.
 *   2. This script queries the registry; any package whose deno.json
 *      version is not yet published is a release.
 *   3. It cascades: every workspace package that depends — directly or
 *      transitively — on a releasing package has its `@skmtc/*` import
 *      pin rewritten to the new version and its own patch version
 *      bumped.
 *   4. All releasing packages are published dependency-order first
 *      (a freshly-published dependency must be up before a dependent
 *      that pins it can resolve).
 */

import { dirname, fromFileUrl, join } from '@std/path'
import { parse as parseYaml } from 'jsr:@std/yaml@^1'
import { toDependencyAgeArgs } from '../cli/lib/dependency-age.ts'

/**
 * Scoped runtime permissions for the installed `skmtc` CLI — replaces a
 * blanket `-A`/`--allow-all`. skmtc reads/writes project files, fetches
 * schemas + packages over the network, reads a few env vars, spawns only
 * `deno` (bundle) and `sh` (typecheck), and needs `homedir` to locate the
 * workspace root. It uses no FFI and no remote imports. Empirically
 * validated against doctor / generate / bundle.
 */
const SKMTC_PERMS = [
  '--allow-read',
  '--allow-write',
  '--allow-net',
  '--allow-env',
  '--allow-run=deno,sh',
  '--allow-sys=homedir'
]
const SKMTC_PERMS_STR = SKMTC_PERMS.join(' ')

export type WorkspacePackage = {
  name: string
  version: string
  dir: string
  imports: Record<string, string>
  /** Names of other workspace packages this one depends on. */
  deps: string[]
  /** `"private": true` in deno.json — cascade-bumped but never published. */
  private?: boolean
}

/** Patch-bump a `x.y.z` version: `0.6.2` → `0.6.3`. */
export const incrementPatch = (version: string): string => {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/)
  if (!match) {
    throw new Error(`Cannot patch-bump a non-"x.y.z" version: ${version}`)
  }
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`
}

/**
 * The workspace package named by a `jsr:@scope/name@x` import value,
 * or `null` when the import is not a `jsr:` specifier or names a
 * package outside the workspace.
 */
export const toWorkspaceDep = (
  importValue: string,
  workspaceNames: ReadonlySet<string>
): string | null => {
  const match = importValue.match(/^jsr:(@[^@/\s]+\/[^@/\s]+)@/)
  return match && workspaceNames.has(match[1]) ? match[1] : null
}

/** Rewrite the version in a `jsr:@scope/name@x[/sub]` import value. */
export const rewriteDepVersion = (importValue: string, newVersion: string): string =>
  importValue.replace(/^(jsr:@[^@/\s]+\/[^@/\s]+)@[^/\s]+(\/.*)?$/, `$1@${newVersion}$2`)

/**
 * Dependency-first order over the full workspace — a package always
 * appears after every workspace package it depends on. Throws on a
 * dependency cycle.
 */
export const toDependencyOrder = (packages: WorkspacePackage[]): WorkspacePackage[] => {
  const pending = new Map(packages.map(p => [p.name, p]))
  const ordered: WorkspacePackage[] = []

  while (pending.size > 0) {
    const ready = [...pending.values()]
      .filter(p => p.deps.every(dep => !pending.has(dep)))
      .sort((a, b) => a.name.localeCompare(b.name))

    if (ready.length === 0) {
      throw new Error(`Dependency cycle among: ${[...pending.keys()].join(', ')}`)
    }

    for (const pkg of ready) {
      ordered.push(pkg)
      pending.delete(pkg.name)
    }
  }

  return ordered
}

export type PlannedRelease = {
  /** The version this package will be published at. */
  version: string
  /** The package's imports, with workspace pins rewritten to the cascade versions. */
  imports: Record<string, string>
}

/**
 * Plan the cascade. `publishedVersions` is the set of `name@version`
 * strings already on the registry.
 *
 * A package is released when either:
 *   - its `deno.json` version is **not** on the registry — you bumped
 *     it directly; it publishes at that version; or
 *   - a workspace dependency is being released — the **cascade**: its
 *     `@skmtc/*` pins are rewritten to the dependency's new version
 *     and its own patch version is bumped.
 *
 * Walking in dependency order means a dependency's final version is
 * always known before its dependents are planned.
 */
export const planRelease = (
  packages: WorkspacePackage[],
  publishedVersions: ReadonlySet<string>
): Map<string, PlannedRelease> => {
  const names = new Set(packages.map(p => p.name))
  const plan = new Map<string, PlannedRelease>()
  const finalVersion = new Map(packages.map(p => [p.name, p.version]))

  for (const pkg of toDependencyOrder(packages)) {
    const imports = { ...pkg.imports }
    let importsChanged = false

    for (const [key, value] of Object.entries(pkg.imports)) {
      const dep = toWorkspaceDep(value, names)
      if (dep && plan.has(dep)) {
        const rewritten = rewriteDepVersion(value, finalVersion.get(dep) as string)
        if (rewritten !== value) {
          imports[key] = rewritten
          importsChanged = true
        }
      }
    }

    // Private packages are never on the registry, so absence there must
    // not direct-release them; they enter the plan only via the cascade.
    const directBump = !pkg.private && !publishedVersions.has(`${pkg.name}@${pkg.version}`)

    if (directBump) {
      // You bumped it — publish at your version, with cascaded pins.
      plan.set(pkg.name, { version: pkg.version, imports })
    } else if (importsChanged) {
      // A dependency moved — patch-bump and republish with new pins.
      const bumped = incrementPatch(pkg.version)
      finalVersion.set(pkg.name, bumped)
      plan.set(pkg.name, { version: bumped, imports })
    }
  }

  return plan
}

type DenoJson = {
  name?: string
  version?: string
  private?: boolean
  imports?: Record<string, string>
  workspace?: string[]
  [key: string]: unknown
}

const readDenoJson = async (path: string): Promise<DenoJson> =>
  JSON.parse(await Deno.readTextFile(path)) as DenoJson

/**
 * A publishable package must never pin a private one — the pin would
 * resolve nowhere on the registry. Throws on the first violation.
 */
export const assertNoPrivateDeps = (packages: WorkspacePackage[]): void => {
  const privateNames = new Set(packages.filter(p => p.private).map(p => p.name))
  for (const pkg of packages) {
    if (pkg.private) continue
    const dep = pkg.deps.find(name => privateNames.has(name))
    if (dep) {
      throw new Error(
        `${pkg.name} is publishable but depends on private package ${dep}. ` +
          `Either drop "private": true from ${dep} or mark ${pkg.name} private too.`
      )
    }
  }
}

/** Discover every named + versioned workspace package and its intra-workspace deps. */
export const discoverWorkspace = async (rootDir: string): Promise<WorkspacePackage[]> => {
  const root = await readDenoJson(join(rootDir, 'deno.json'))
  if (!root.workspace) {
    throw new Error('No `workspace` array in root deno.json')
  }

  const raw: Array<{ dir: string; cfg: DenoJson }> = []
  for (const rel of root.workspace) {
    const dir = join(rootDir, rel.replace(/^\.\//, ''))
    const cfg = await readDenoJson(join(dir, 'deno.json'))
    if (!cfg.name || !cfg.version) {
      console.warn(`Skipping ${rel}: deno.json has no name/version`)
      continue
    }
    raw.push({ dir, cfg })
  }

  const names = new Set(raw.map(r => r.cfg.name as string))
  return raw.map(({ dir, cfg }) => {
    const imports = cfg.imports ?? {}
    return {
      name: cfg.name as string,
      version: cfg.version as string,
      private: cfg.private === true,
      dir,
      imports,
      deps: [
        ...new Set(
          Object.values(imports)
            .map(value => toWorkspaceDep(value, names))
            .filter((dep): dep is string => dep !== null)
        )
      ]
    }
  })
}

/**
 * Write each package's planned version + cascaded import pins back to its
 * `deno.json`, preserving every other field. Shared by the release cascade
 * (which then publishes) and the `bump` task (which stops here and leaves the
 * publish to CI), so both produce byte-identical edits.
 */
export const applyPlan = async (
  order: readonly WorkspacePackage[],
  plan: ReadonlyMap<string, PlannedRelease>
): Promise<void> => {
  for (const pkg of order) {
    const planned = plan.get(pkg.name)
    if (!planned) continue
    const path = join(pkg.dir, 'deno.json')
    const cfg = await readDenoJson(path)
    cfg.version = planned.version
    cfg.imports = planned.imports
    await Deno.writeTextFile(path, JSON.stringify(cfg, null, 2) + '\n')
  }
}

/** Whether `name@version` is already published on the registry. */
const isPublished = async (jsrUrl: string, name: string, version: string): Promise<boolean> => {
  const res = await fetch(`${jsrUrl}${name}/meta.json`)
  if (res.status === 404) {
    await res.body?.cancel()
    return false
  }
  if (!res.ok) {
    throw new Error(`Registry lookup for ${name} failed: ${res.status} ${res.statusText}`)
  }
  const meta = (await res.json()) as { versions?: Record<string, unknown> }
  return Boolean(meta.versions?.[version])
}

/**
 * What to do with the local `~/.deno/bin/skmtc` binary after a CLI
 * publish. The release loop knows the new version; this controls
 * whether it bumps the binary too.
 *
 *  - `none` — print the install command on stderr and exit. CI-safe.
 *  - `local-compile` — `deno compile` against the local repo source
 *    (per `cli/CLAUDE.md`'s install card). Right for in-repo dev where
 *    a JSR install can't resolve the `@/` alias.
 *  - `jsr-install` — `deno install <scoped-perms> -g
 *    --unstable-worker-options -n skmtc -f jsr:@skmtc/cli@<version>`
 *    (see {@link SKMTC_PERMS}), after polling the registry's
 *    `meta.json.versions` map for the new version (don't trust
 *    `meta.json.latest` — local JSR sorts it lexicographically; see
 *    `[[project_local_jsr_latest_lex_sort]]`).
 */
export type ReinstallCliMode = 'none' | 'local-compile' | 'jsr-install'

const parseReinstallMode = (args: readonly string[]): ReinstallCliMode => {
  for (const arg of args) {
    if (arg.startsWith('--reinstall-cli=')) {
      const value = arg.slice('--reinstall-cli='.length)
      if (value === 'none' || value === 'local-compile' || value === 'jsr-install') {
        return value
      }
      throw new Error(
        `Unknown --reinstall-cli mode: ${value}. Use none, local-compile, or jsr-install.`
      )
    }
  }
  return 'none'
}

/**
 * Poll the registry until the named version appears in
 * `meta.json.versions`. Returns when present; throws on timeout.
 * Local JSR's CDN propagation is the gotcha this guards against —
 * a fresh publish can return 404 / not-yet-listed for a beat.
 */
const waitForJsrPropagation = async (
  jsrUrl: string,
  name: string,
  version: string
): Promise<void> => {
  const delays = [0, 1000, 2000, 4000, 6000, 8000, 10000] // ~31s total
  for (let i = 0; i < delays.length; i++) {
    if (delays[i] > 0) await new Promise(r => setTimeout(r, delays[i]))
    const res = await fetch(`${jsrUrl}${name}/meta.json`, {
      cache: 'no-store',
      headers: { 'cache-control': 'no-cache' }
    })
    if (res.ok) {
      const meta = (await res.json()) as { versions?: Record<string, unknown> }
      if (meta.versions?.[version]) return
    } else {
      await res.body?.cancel()
    }
  }
  throw new Error(
    `${name}@${version} did not appear in ${jsrUrl}${name}/meta.json within ~30s. ` +
      `Skipping CLI reinstall — run the install command manually.`
  )
}

const reinstallCliLocalCompile = async (cliDir: string): Promise<void> => {
  const home = Deno.env.get('HOME') ?? Deno.env.get('USERPROFILE')
  if (!home) throw new Error('Cannot resolve $HOME for the install target.')
  const target = join(home, '.deno', 'bin', 'skmtc')
  console.log(`Compiling local CLI → ${target}...`)
  const result = await new Deno.Command('deno', {
    args: [
      'compile',
      '--no-check',
      ...SKMTC_PERMS,
      '--unstable-worker-options',
      '--config',
      join(cliDir, 'deno.json'),
      '--include',
      cliDir,
      '-o',
      target,
      join(cliDir, 'mod.ts')
    ],
    stdout: 'inherit',
    stderr: 'inherit'
  }).output()
  if (!result.success) {
    throw new Error(`deno compile failed (exit ${result.code}).`)
  }
}

/**
 * `deno install` args for the just-published CLI. The version landed
 * seconds ago, so it sits as deep inside Deno's dependency-age window as
 * a version gets — and an EXACT pin inside that window is a hard
 * resolution error, not a silent downgrade. Both the run and the printed
 * recovery command build from here so neither can lose the flag.
 */
export const toJsrInstallArgs = (version: string): string[] => [
  'install',
  ...toDependencyAgeArgs(),
  ...SKMTC_PERMS,
  '-g',
  '--unstable-worker-options',
  '-n',
  'skmtc',
  '-f',
  `jsr:@skmtc/cli@${version}`
]

/**
 * The same install as a copy-pasteable line. This one is handed to
 * consumers running OUTSIDE this workspace, where `deno/deno.json`'s
 * `minimumDependencyAge: "0"` does not apply — so the string has to
 * carry the flag itself or it reproduces the error it exists to recover
 * from.
 */
export const toJsrReinstallCommand = (jsrUrl: string, version: string): string =>
  `JSR_URL=${jsrUrl} deno ${toJsrInstallArgs(version).join(' ')}`

const reinstallCliFromJsr = async (jsrUrl: string, version: string): Promise<void> => {
  console.log(`Polling ${jsrUrl}@skmtc/cli for v${version}...`)
  await waitForJsrPropagation(jsrUrl, '@skmtc/cli', version)
  console.log(`Installing @skmtc/cli@${version} from JSR...`)
  const result = await new Deno.Command('deno', {
    args: toJsrInstallArgs(version),
    env: { ...Deno.env.toObject(), JSR_URL: jsrUrl },
    stdout: 'inherit',
    stderr: 'inherit'
  }).output()
  if (!result.success) {
    throw new Error(`deno install failed (exit ${result.code}).`)
  }
}

const printReinstallHint = (
  mode: ReinstallCliMode,
  cliDir: string,
  version: string,
  jsrUrl: string
): void => {
  // The "none" mode lands here always; the other modes land here only on
  // error paths so the operator can recover manually.
  console.error('\nTo reinstall the local `skmtc` binary, choose one:')
  console.error('  # In-repo dev (recommended while iterating locally):')
  console.error(`  deno compile --no-check ${SKMTC_PERMS_STR} --unstable-worker-options \\`)
  console.error(`    --config ${join(cliDir, 'deno.json')} \\`)
  console.error(`    --include ${cliDir} \\`)
  console.error(`    -o ~/.deno/bin/skmtc \\`)
  console.error(`    ${join(cliDir, 'mod.ts')}`)
  console.error('  # From JSR (downstream consumers):')
  console.error(`  ${toJsrReinstallCommand(jsrUrl, version)}`)
  if (mode !== 'none') {
    console.error(`(mode "${mode}" was attempted but failed — defer to the manual commands above.)`)
  }
}

/**
 * `metadata.describes` out of a SKILL.md, parsed as YAML.
 *
 * A regex over the frontmatter was whitespace-exact, so re-indenting it or
 * quoting it differently silently emptied the declaration — and an emptied
 * declaration disables the guard rather than failing it.
 */
const readDescribes = (skillText: string): Record<string, string> => {
  const block = skillText.match(/^---\n([\s\S]*?)\n---\n/)
  if (!block) return {}
  const frontmatter = parseYaml(block[1])
  if (!isRecord(frontmatter) || !isRecord(frontmatter.metadata)) return {}
  const describes = frontmatter.metadata.describes
  if (!isRecord(describes)) return {}
  return Object.fromEntries(
    Object.entries(describes).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string'
    )
  )
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * A published skill declares the package minor it was written against
 * (`metadata.describes`). Releasing past that declaration without touching the
 * skill is how a skill starts lying: every export keeps its name, the rule it
 * teaches changes, and no mechanical check notices.
 *
 * So the release refuses. The fix is to reread the skill against the diff and
 * then update the declaration — one frontmatter edit, in the same PR as the
 * change that forced it.
 */
const assertSkillDeclarations = async (
  rootDir: string,
  planned: Map<string, string>
): Promise<void> => {
  const skillsDir = join(rootDir, 'docs', 'skills')
  const stale: string[] = []

  for await (const entry of Deno.readDir(skillsDir)) {
    if (!entry.isDirectory || entry.name.startsWith('.')) continue
    const text = await Deno.readTextFile(join(skillsDir, entry.name, 'SKILL.md')).catch(() => '')
    for (const [packageName, declaredMinor] of Object.entries(readDescribes(text))) {
      const releasing = planned.get(packageName)
      if (!releasing) continue
      const releasingMinor = releasing.split('.').slice(0, 2).join('.')
      if (releasingMinor !== declaredMinor) {
        stale.push(
          `  ${entry.name} was written against ${packageName} ${declaredMinor}; ` +
            `releasing ${releasing}`
        )
      }
    }
  }

  if (stale.length > 0) {
    throw new Error(
      `Release refused — a skill describes a minor this release moves past:\n${stale.join('\n')}\n\n` +
        `Reread each skill against the package diff, update metadata.describes in its ` +
        `SKILL.md, and re-run. Nothing has been published.`
    )
  }
}

export const release = async (): Promise<void> => {
  const reinstallMode = parseReinstallMode(Deno.args)
  const rootDir = join(dirname(fromFileUrl(import.meta.url)), '..')
  const jsrUrl = (Deno.env.get('JSR_URL') ?? 'https://jsr.io/').replace(/\/*$/, '/')

  console.log(`Registry: ${jsrUrl}\n`)
  const packages = await discoverWorkspace(rootDir)
  assertNoPrivateDeps(packages)

  const published = new Set<string>()
  for (const pkg of packages) {
    if (pkg.private) {
      console.log(`  private    ${pkg.name}@${pkg.version}`)
      continue
    }
    const isUp = await isPublished(jsrUrl, pkg.name, pkg.version)
    console.log(`  ${isUp ? 'published' : 'PENDING  '}  ${pkg.name}@${pkg.version}`)
    if (isUp) published.add(`${pkg.name}@${pkg.version}`)
  }

  const plan = planRelease(packages, published)
  if (plan.size === 0) {
    console.log('\nNothing to publish — every deno.json version is already on the registry.')
    return
  }

  const order = toDependencyOrder(packages).filter(p => plan.has(p.name))

  console.log('\nRelease plan (dependency order):')
  for (const pkg of order) {
    const planned = plan.get(pkg.name) as PlannedRelease
    const type =
      pkg.version === planned.version ? 'direct' : `cascade ${pkg.version} -> ${planned.version}`
    const suffix = pkg.private ? ', private — bump only' : ''
    console.log(`  ${pkg.name}@${planned.version}  (${type}${suffix})`)
  }

  await assertSkillDeclarations(
    rootDir,
    new Map(order.map(pkg => [pkg.name, (plan.get(pkg.name) as PlannedRelease).version]))
  )

  console.log('\nApplying version + import updates...')
  await applyPlan(order, plan)

  console.log('\nPublishing...')
  // With a JSR_AUTH_TOKEN (e.g. the local mirror's shared secret) the
  // token is passed explicitly; without one, `deno publish` falls back
  // to OIDC in GitHub Actions or interactive auth locally.
  const publishToken = Deno.env.get('JSR_AUTH_TOKEN')
  for (const pkg of order) {
    const planned = plan.get(pkg.name) as PlannedRelease
    if (pkg.private) {
      console.log(`\n--- ${pkg.name}@${planned.version} — private, bumped but not published ---`)
      continue
    }
    console.log(`\n--- ${pkg.name}@${planned.version} ---`)
    const result = await new Deno.Command('deno', {
      args: ['task', 'publish', ...(publishToken ? [`--token=${publishToken}`] : [])],
      cwd: pkg.dir,
      stdout: 'inherit',
      stderr: 'inherit'
    }).output()
    if (!result.success) {
      throw new Error(
        `Publish failed for ${pkg.name}@${planned.version} (exit ${result.code}). ` +
          `Earlier packages in the plan are already published — fix the failure ` +
          `and re-run; the registry check will skip what is already up.`
      )
    }
  }

  const toNameAtVersion = (p: WorkspacePackage): string =>
    `${p.name}@${(plan.get(p.name) as PlannedRelease).version}`
  const releasedPackages = order.filter(p => !p.private)
  const bumpedPrivate = order.filter(p => p.private)
  console.log(`\nReleased: ${releasedPackages.map(toNameAtVersion).join(', ')}`)
  if (bumpedPrivate.length > 0) {
    console.log(
      `Bumped but private (publish manually if needed): ${bumpedPrivate.map(toNameAtVersion).join(', ')}`
    )
  }

  // If @skmtc/cli was in the release order, the locally-installed
  // `skmtc` binary is now behind. Offer to bring it up to date.
  const cliPackage = order.find(p => p.name === '@skmtc/cli')
  if (!cliPackage) return

  const cliVersion = (plan.get(cliPackage.name) as PlannedRelease).version
  const cliDir = cliPackage.dir

  if (reinstallMode === 'none') {
    printReinstallHint('none', cliDir, cliVersion, jsrUrl)
    return
  }

  try {
    if (reinstallMode === 'local-compile') {
      await reinstallCliLocalCompile(cliDir)
    } else {
      await reinstallCliFromJsr(jsrUrl, cliVersion)
    }
    console.log(`\nLocal \`skmtc\` binary now at ${cliVersion} (${reinstallMode}).`)
  } catch (err) {
    console.error(`\nReinstall failed: ${err instanceof Error ? err.message : String(err)}`)
    printReinstallHint(reinstallMode, cliDir, cliVersion, jsrUrl)
    // Don't exit non-zero — the publish itself succeeded; the reinstall
    // is a convenience.
  }
}

if (import.meta.main) {
  try {
    await release()
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`)
    Deno.exit(1)
  }
}
