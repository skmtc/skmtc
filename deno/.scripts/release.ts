#!/usr/bin/env -S deno run --allow-read --allow-env --allow-net --allow-run
/**
 * Release: publish every workspace package whose `deno.json` version
 * is not yet on the JSR registry.
 *
 * The registry is the single source of truth for "what is published";
 * each package's `deno.json` is the source of truth for "what version
 * it is at". A release is simply the gap between the two.
 *
 * There is no local state file and no source-hashing. Both were a
 * cache of "what was last published" — and, like any cache, it
 * drifted out of sync and became a source of confusion. The registry
 * cannot go stale relative to itself, so it is queried directly.
 *
 * Bumping a `version`, and updating an `@skmtc/*` import pin to adopt
 * a newer workspace dependency, are deliberate edits committed to git
 * like any other change — not something inferred. To release a
 * change: bump the package's `version` in its `deno.json` (and update
 * its `@skmtc/*` pins if it should consume a newer workspace dep),
 * commit, then run this script — directly or via `deno task release`.
 */

import { dirname, fromFileUrl, join } from '@std/path'

const DEFAULT_JSR_URL = 'https://jsr.skmtc.dev/'

export type WorkspacePackage = {
  name: string
  version: string
  dir: string
  /** Names of other workspace packages this one depends on. */
  deps: string[]
}

/**
 * The workspace package referenced by a `jsr:@scope/name@x` import
 * value, or `null` when the import is not a `jsr:` specifier or names
 * a package outside the workspace.
 */
export const toWorkspaceDep = (
  importValue: string,
  workspaceNames: ReadonlySet<string>
): string | null => {
  const match = importValue.match(/^jsr:(@[^@/\s]+\/[^@/\s]+)@/)
  if (!match) return null
  return workspaceNames.has(match[1]) ? match[1] : null
}

/**
 * Order packages so a dependency is always published before any
 * dependent — `deno publish` resolves a package's `jsr:` pins against
 * the registry, so a freshly-published dependency must already be up.
 * Dependencies outside the set (already published) do not constrain
 * the order. Throws on a dependency cycle.
 */
export const toReleaseOrder = (
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

type DenoJson = {
  name?: string
  version?: string
  imports?: Record<string, string>
  workspace?: string[]
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

  const configs: Array<{ dir: string; cfg: DenoJson }> = []
  for (const rel of root.workspace) {
    const dir = join(rootDir, rel.replace(/^\.\//, ''))
    const cfg = await readDenoJson(join(dir, 'deno.json'))
    if (!cfg.name || !cfg.version) {
      console.warn(`Skipping ${rel}: deno.json has no name/version`)
      continue
    }
    configs.push({ dir, cfg })
  }

  const names = new Set(configs.map(c => c.cfg.name as string))
  return configs.map(({ dir, cfg }) => ({
    name: cfg.name as string,
    version: cfg.version as string,
    dir,
    deps: [
      ...new Set(
        Object.values(cfg.imports ?? {})
          .map(value => toWorkspaceDep(value, names))
          .filter((dep): dep is string => dep !== null)
      )
    ]
  }))
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

  const toPublish: WorkspacePackage[] = []
  for (const pkg of packages) {
    const published = await isPublished(jsrUrl, pkg.name, pkg.version)
    console.log(`  ${published ? 'published' : 'PENDING  '}  ${pkg.name}@${pkg.version}`)
    if (!published) toPublish.push(pkg)
  }

  if (toPublish.length === 0) {
    console.log('\nNothing to publish — every deno.json version is already on the registry.')
    return
  }

  const order = toReleaseOrder(toPublish)
  console.log(`\nPublishing ${order.length} package(s), dependencies first:`)

  for (const pkg of order) {
    console.log(`\n--- ${pkg.name}@${pkg.version} ---`)
    const result = await new Deno.Command('deno', {
      args: ['task', 'publish'],
      cwd: pkg.dir,
      stdout: 'inherit',
      stderr: 'inherit'
    }).output()
    if (!result.success) {
      throw new Error(
        `Publish failed for ${pkg.name}@${pkg.version} (exit ${result.code})`
      )
    }
  }

  console.log(`\nReleased: ${order.map(p => `${p.name}@${p.version}`).join(', ')}`)
}

if (import.meta.main) {
  try {
    await release()
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`)
    Deno.exit(1)
  }
}
