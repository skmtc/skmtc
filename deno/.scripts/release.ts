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

const DEFAULT_JSR_URL = 'https://jsr.skmtc.dev/'

export type WorkspacePackage = {
  name: string
  version: string
  dir: string
  imports: Record<string, string>
  /** Names of other workspace packages this one depends on. */
  deps: string[]
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
const rewriteDepVersion = (importValue: string, newVersion: string): string =>
  importValue.replace(
    /^(jsr:@[^@/\s]+\/[^@/\s]+)@[^/\s]+(\/.*)?$/,
    `$1@${newVersion}$2`
  )

/**
 * Dependency-first order over the full workspace — a package always
 * appears after every workspace package it depends on. Throws on a
 * dependency cycle.
 */
export const toDependencyOrder = (
  packages: WorkspacePackage[]
): WorkspacePackage[] => {
  const pending = new Map(packages.map(p => [p.name, p]))
  const ordered: WorkspacePackage[] = []

  while (pending.size > 0) {
    const ready = [...pending.values()]
      .filter(p => p.deps.every(dep => !pending.has(dep)))
      .sort((a, b) => a.name.localeCompare(b.name))

    if (ready.length === 0) {
      throw new Error(
        `Dependency cycle among: ${[...pending.keys()].join(', ')}`
      )
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

    const directBump = !publishedVersions.has(`${pkg.name}@${pkg.version}`)

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
  imports?: Record<string, string>
  workspace?: string[]
  [key: string]: unknown
}

const readDenoJson = async (path: string): Promise<DenoJson> =>
  JSON.parse(await Deno.readTextFile(path)) as DenoJson

/** Discover every named + versioned workspace package and its intra-workspace deps. */
export const discoverWorkspace = async (
  rootDir: string
): Promise<WorkspacePackage[]> => {
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

/** Whether `name@version` is already published on the registry. */
const isPublished = async (
  jsrUrl: string,
  name: string,
  version: string
): Promise<boolean> => {
  const res = await fetch(`${jsrUrl}${name}/meta.json`)
  if (res.status === 404) {
    await res.body?.cancel()
    return false
  }
  if (!res.ok) {
    throw new Error(
      `Registry lookup for ${name} failed: ${res.status} ${res.statusText}`
    )
  }
  const meta = (await res.json()) as { versions?: Record<string, unknown> }
  return Boolean(meta.versions?.[version])
}

export const release = async (): Promise<void> => {
  const rootDir = join(dirname(fromFileUrl(import.meta.url)), '..')
  const jsrUrl = (Deno.env.get('JSR_URL') ?? DEFAULT_JSR_URL).replace(/\/*$/, '/')

  console.log(`Registry: ${jsrUrl}\n`)
  const packages = await discoverWorkspace(rootDir)

  const published = new Set<string>()
  for (const pkg of packages) {
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
    const kind = pkg.version === planned.version
      ? 'direct'
      : `cascade ${pkg.version} -> ${planned.version}`
    console.log(`  ${pkg.name}@${planned.version}  (${kind})`)
  }

  console.log('\nApplying version + import updates...')
  for (const pkg of order) {
    const planned = plan.get(pkg.name) as PlannedRelease
    const path = join(pkg.dir, 'deno.json')
    const cfg = await readDenoJson(path)
    cfg.version = planned.version
    cfg.imports = planned.imports
    await Deno.writeTextFile(path, JSON.stringify(cfg, null, 2) + '\n')
  }

  console.log('\nPublishing...')
  for (const pkg of order) {
    const planned = plan.get(pkg.name) as PlannedRelease
    console.log(`\n--- ${pkg.name}@${planned.version} ---`)
    const result = await new Deno.Command('deno', {
      args: ['task', 'publish'],
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

  console.log(
    `\nReleased: ${order.map(p => `${p.name}@${(plan.get(p.name) as PlannedRelease).version}`).join(', ')}`
  )
}

if (import.meta.main) {
  try {
    await release()
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`)
    Deno.exit(1)
  }
}
