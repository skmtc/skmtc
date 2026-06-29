#!/usr/bin/env -S deno run --allow-read --allow-write
/**
 * Bump: raise the `version` of the package(s) you directly changed and
 * cascade that across the whole `deno/` workspace — every dependent has its
 * `@skmtc/*` import pins rewritten to the new versions and its own version
 * patch-bumped, in dependency order.
 *
 * This is the planning half of the release cascade (`.scripts/release.ts`)
 * with NO registry check and NO publish step: it only edits `deno.json`
 * files. CI publishes (the `Publish` workflow runs `deno task release`,
 * which then sees these bumped versions as not-yet-on-registry and ships
 * them).
 *
 * Usage:
 *   deno task bump core               # 0.20.0 -> 0.20.1 (patch, default)
 *   deno task bump core --minor       # 0.20.0 -> 0.21.0
 *   deno task bump cli core --major   # bump several at once
 *   deno task bump core --dry-run     # print the plan, write nothing
 *
 * A package may be named by its workspace directory (`core`) or its full
 * package name (`@skmtc/core`). Explicitly-named packages bump by the chosen
 * level; cascaded dependents always patch-bump (matching the release
 * cascade), so the result is exactly what `deno task release` would have
 * produced.
 */

import { basename, dirname, fromFileUrl, join } from '@std/path'
import {
  applyPlan,
  discoverWorkspace,
  incrementPatch,
  type PlannedRelease,
  rewriteDepVersion,
  toDependencyOrder,
  toWorkspaceDep,
  type WorkspacePackage
} from './release.ts'

export type BumpLevel = 'patch' | 'minor' | 'major'

/** Bump one component of a `x.y.z` version, zeroing the lower components. */
export const incrementVersion = (version: string, level: BumpLevel): string => {
  if (level === 'patch') return incrementPatch(version)

  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/)
  if (!match) {
    throw new Error(`Cannot bump a non-"x.y.z" version: ${version}`)
  }
  const major = Number(match[1])
  const minor = Number(match[2])

  return level === 'major' ? `${major + 1}.0.0` : `${major}.${minor + 1}.0`
}

/**
 * Plan a bump cascade. `targets` maps an explicitly-named package to the
 * level it should bump by. Walking in dependency order, a package is in the
 * plan when either:
 *   - it is an explicit target — it bumps by its level; or
 *   - one of its workspace dependencies is in the plan — the cascade: its
 *     `@skmtc/*` pins are rewritten to the dependency's new version and its
 *     own patch version is bumped.
 *
 * Mirrors {@link planRelease}, but the explicit-target set drives the direct
 * bumps in place of the registry's published-versions set.
 */
export const planBump = (
  packages: WorkspacePackage[],
  targets: ReadonlyMap<string, BumpLevel>
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

    const level = targets.get(pkg.name)
    if (level) {
      // Explicitly named — bump by the requested level.
      const bumped = incrementVersion(pkg.version, level)
      finalVersion.set(pkg.name, bumped)
      plan.set(pkg.name, { version: bumped, imports })
    } else if (importsChanged) {
      // A workspace dependency moved — patch-bump and repin.
      const bumped = incrementPatch(pkg.version)
      finalVersion.set(pkg.name, bumped)
      plan.set(pkg.name, { version: bumped, imports })
    }
  }

  return plan
}

/** Resolve a CLI token (dir name or full package name) to a workspace package. */
export const resolveTarget = (
  token: string,
  packages: readonly WorkspacePackage[]
): WorkspacePackage => {
  const byName = packages.find(p => p.name === token)
  if (byName) return byName

  const byDir = packages.filter(p => basename(p.dir) === token)
  if (byDir.length === 1) return byDir[0]
  if (byDir.length > 1) {
    throw new Error(
      `Ambiguous package "${token}": matches ${byDir.map(p => p.name).join(', ')}`
    )
  }

  const available = packages.map(p => `${basename(p.dir)} (${p.name})`).join(', ')
  throw new Error(`Unknown package "${token}". Available: ${available}`)
}

type BumpArgs = { tokens: string[]; level: BumpLevel; dryRun: boolean }

export const parseBumpArgs = (args: readonly string[]): BumpArgs => {
  const tokens: string[] = []
  let level: BumpLevel = 'patch'
  let dryRun = false

  for (const arg of args) {
    switch (arg) {
      case '--patch':
        level = 'patch'
        break
      case '--minor':
        level = 'minor'
        break
      case '--major':
        level = 'major'
        break
      case '--dry-run':
        dryRun = true
        break
      default:
        if (arg.startsWith('--')) {
          throw new Error(`Unknown flag: ${arg}`)
        }
        tokens.push(arg)
    }
  }

  if (tokens.length === 0) {
    throw new Error(
      'Usage: deno task bump <package...> [--patch|--minor|--major] [--dry-run]'
    )
  }

  return { tokens, level, dryRun }
}

export const bump = async (): Promise<void> => {
  const { tokens, level, dryRun } = parseBumpArgs(Deno.args)
  const rootDir = join(dirname(fromFileUrl(import.meta.url)), '..')
  const packages = await discoverWorkspace(rootDir)

  const targets = new Map<string, BumpLevel>()
  for (const token of tokens) {
    targets.set(resolveTarget(token, packages).name, level)
  }

  const plan = planBump(packages, targets)
  const order = toDependencyOrder(packages).filter(p => plan.has(p.name))

  console.log(`Bump (${level}) + cascade:\n`)
  for (const pkg of order) {
    const planned = plan.get(pkg.name) as PlannedRelease
    const type = targets.has(pkg.name) ? level : 'cascade patch'
    console.log(`  ${pkg.name}  ${pkg.version} -> ${planned.version}  (${type})`)
  }

  if (dryRun) {
    console.log('\n--dry-run: no files written.')
    return
  }

  await applyPlan(order, plan)
  console.log(
    `\nUpdated ${order.length} package${order.length === 1 ? '' : 's'}. ` +
      `Commit, merge, then trigger the Publish workflow (CI runs the cascade).`
  )
}

if (import.meta.main) {
  try {
    await bump()
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`)
    Deno.exit(1)
  }
}
