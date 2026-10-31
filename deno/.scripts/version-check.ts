#!/usr/bin/env -S deno run --allow-read --allow-env --allow-net --allow-run=git
/**
 * Version check: fail a branch whose changed package will not ship.
 *
 * Two branches that each run `deno task bump core` from the same base pick
 * the same version, and merging main into the second one shows no conflict.
 * The Publish workflow then finds that version already on JSR and publishes
 * nothing. This check fails such a branch before it merges.
 *
 * Usage:
 *   deno task version-check --base origin/main
 *
 * CI runs it on every pull request with the base commit of the pull request.
 * It needs the network (the registry lookup) and git history back to the
 * merge base, so it is not part of `deno task check`.
 */

import { dirname, fromFileUrl, join, relative, SEPARATOR } from '@std/path'
import { discoverWorkspace, isPublished, toJsrUrl, type WorkspacePackage } from './release.ts'
import { runGit } from './run-git.ts'

export type VersionCheckPackage = Pick<WorkspacePackage, 'name' | 'version' | 'private'> & {
  /** Directory relative to the workspace root, with `/` separators: `core`. */
  directory: string
}

/**
 * Whether a changed file counts as a change to the package that ships.
 * `deno.json` is left out because a cascade patch bump changes only that;
 * test files are left out because they do not change what users get.
 * Everything else counts, README and docs included, because JSR ships them.
 */
export const isShippedChange = (directory: string, file: string): boolean => {
  if (!file.startsWith(`${directory}/`)) return false
  const segments = file.slice(directory.length + 1).split('/')
  const fileName = segments[segments.length - 1]
  if (segments.length === 1 && fileName === 'deno.json') return false
  if (fileName.endsWith('.test.ts') || fileName.endsWith('.test.tsx')) return false
  return !segments.slice(0, -1).some(segment => segment === 'test' || segment === 'tests')
}

export type VersionProblemsInput = {
  packages: readonly VersionCheckPackage[]
  /** Files changed since the merge base, relative to the workspace root. */
  changedFiles: readonly string[]
  /** Each package's version at the base; absent for a package the base does not have. */
  baseVersions: ReadonlyMap<string, string>
  /** `name@version` strings already published on the registry. */
  published: ReadonlySet<string>
}

/**
 * One line per publishable package that changed but will not ship: its
 * version equals the base's, or is already on the registry. Each line names
 * the command that fixes it.
 */
export const toVersionProblems = ({
  packages,
  changedFiles,
  baseVersions,
  published
}: VersionProblemsInput): string[] =>
  packages.flatMap(pkg => {
    if (pkg.private) return []
    if (!changedFiles.some(file => isShippedChange(pkg.directory, file))) return []

    const fix = `run \`deno task bump ${pkg.directory}\``
    if (baseVersions.get(pkg.name) === pkg.version) {
      return [`${pkg.name}: files changed but version ${pkg.version} equals the base's; ${fix}`]
    }
    if (published.has(`${pkg.name}@${pkg.version}`)) {
      return [`${pkg.name}: version ${pkg.version} is already published on JSR; ${fix}`]
    }
    return []
  })

export const parseVersionCheckArgs = (args: readonly string[]): { base: string } => {
  const index = args.indexOf('--base')
  const base = index === -1 ? undefined : args[index + 1]
  if (!base || base.startsWith('--') || args.length !== 2) {
    throw new Error('Usage: deno task version-check --base <ref>')
  }
  return { base }
}

/** The package's `deno.json` version at `ref`, or `undefined` when it has none there. */
const readVersionAt = async (
  rootDir: string,
  ref: string,
  directory: string
): Promise<string | undefined> => {
  const path = `${directory}/deno.json`
  const listed = await runGit(rootDir, ['ls-tree', '--name-only', ref, '--', path])
  if (listed.trim() === '') return undefined
  const config: unknown = JSON.parse(await runGit(rootDir, ['show', `${ref}:./${path}`]))
  return typeof config === 'object' && config !== null && 'version' in config
    ? String(config.version)
    : undefined
}

export const versionCheck = async (): Promise<string[]> => {
  const { base } = parseVersionCheckArgs(Deno.args)
  const rootDir = join(dirname(fromFileUrl(import.meta.url)), '..')
  const jsrUrl = toJsrUrl()

  const packages: VersionCheckPackage[] = (await discoverWorkspace(rootDir)).map(pkg => ({
    name: pkg.name,
    version: pkg.version,
    private: pkg.private,
    directory: relative(rootDir, pkg.dir).split(SEPARATOR).join('/')
  }))

  // `base...HEAD` diffs from the merge base, so a stale branch does not
  // count main's newer commits as its own changes. `--no-renames` lists both
  // sides of a move, so the package a file left counts as changed too.
  const changedFiles = (
    await runGit(rootDir, ['diff', '--name-only', '--no-renames', '--relative', `${base}...HEAD`])
  )
    .split('\n')
    .filter(line => line !== '')

  const baseVersions = new Map<string, string>()
  const published = new Set<string>()
  for (const pkg of packages) {
    const baseVersion = await readVersionAt(rootDir, base, pkg.directory)
    if (baseVersion !== undefined) baseVersions.set(pkg.name, baseVersion)
    if (!pkg.private && (await isPublished(jsrUrl, pkg.name, pkg.version))) {
      published.add(`${pkg.name}@${pkg.version}`)
    }
  }

  return toVersionProblems({ packages, changedFiles, baseVersions, published })
}

if (import.meta.main) {
  try {
    const problems = await versionCheck()
    if (problems.length > 0) {
      console.error(`Version check failed:\n${problems.map(line => `  ${line}`).join('\n')}`)
      Deno.exit(1)
    }
    console.log('Version check passed: every changed package has a version that will publish.')
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`)
    Deno.exit(1)
  }
}
