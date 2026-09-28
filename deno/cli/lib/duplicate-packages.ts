/**
 * Detects more than one copy of `@skmtc/core` or a `@skmtc/lang-*`
 * package in a project's module graph.
 *
 * The engine recognizes definitions, files and snippets with
 * `instanceof`. Across two copies of core those checks fail, so a run
 * finds nothing, writes empty files and still reports success. `bundle`,
 * `generate` and `doctor` read the graph `deno info` resolves for the
 * project's `worker.ts` — the graph `deno bundle` builds — and name each
 * version with the packages that import it.
 */

import { join } from '@std/path/join'
import { relative } from '@std/path/relative'
import { fromFileUrl } from '@std/path/from-file-url'
import { existsSync } from '@std/fs/exists'
import { compare } from '@std/semver/compare'
import { tryParse } from '@std/semver/try-parse'
import * as v from 'valibot'
import { toDependencyAgeArgs } from '@/lib/dependency-age.ts'
import { getJsrBaseUrl } from '@/lib/jsr-registry.ts'

const moduleSpecifier = v.object({ specifier: v.string() })

const moduleGraphSchema = v.object({
  modules: v.array(
    v.object({
      specifier: v.string(),
      /** Set when the module failed to load — `deno info` still exits 0. */
      error: v.optional(v.string()),
      dependencies: v.optional(
        v.array(
          v.object({
            code: v.optional(moduleSpecifier),
            type: v.optional(moduleSpecifier)
          })
        )
      )
    })
  ),
  redirects: v.optional(v.record(v.string(), v.string()))
})

/** The part of `deno info --json` output the check reads. */
export type ModuleGraph = v.InferOutput<typeof moduleGraphSchema>

export type PackageCopy = {
  version: string
  /**
   * Packages (`@scope/name@version`) and project files (path relative to
   * the project) that import this copy directly.
   */
  importedBy: string[]
}

export type TrackedPackage = {
  /** `@skmtc/core` or a `@skmtc/lang-*` package. */
  name: string
  /** One entry per resolved version, oldest first. */
  copies: PackageCopy[]
}

export type ModuleGraphCheck =
  | {
      type: 'single-copies'
      /** Every tracked package in the graph — each with one copy. */
      packages: TrackedPackage[]
    }
  | {
      type: 'duplicates'
      /** Tracked packages that resolve to more than one version. */
      duplicates: TrackedPackage[]
    }
  | {
      /** No `worker.ts`, or `deno info` could not resolve the graph. */
      type: 'unavailable'
      reason: string
    }

export type CheckModuleGraphFn = (projectPath: string) => Promise<ModuleGraphCheck>

const isTrackedPackage = (name: string): boolean =>
  name === '@skmtc/core' || name.startsWith('@skmtc/lang-')

type PackageVersion = {
  name: string
  version: string
}

/**
 * The JSR package a module URL belongs to — `<registry>/@scope/name/version/…`.
 * `undefined` for local files and for anything outside the registry.
 */
const toPackageVersion = (specifier: string, registryUrl: string): PackageVersion | undefined => {
  const prefix = `${registryUrl}/`
  if (!specifier.startsWith(prefix)) return undefined

  const [scope, packageName, version] = specifier.slice(prefix.length).split('/')
  if (!scope?.startsWith('@') || !packageName || !version) return undefined

  return { name: `${scope}/${packageName}`, version }
}

/** Follows `jsr:` specifiers to the module URL they load. */
const toModuleUrl = (
  specifier: string,
  redirects: Record<string, string>,
  seen: ReadonlySet<string> = new Set()
): string => {
  const next = redirects[specifier]
  if (next === undefined || seen.has(specifier)) return specifier
  return toModuleUrl(next, redirects, new Set(seen).add(specifier))
}

type ToImporterLabelArgs = {
  specifier: string
  registryUrl: string
  projectPath: string
}

const toImporterLabel = ({ specifier, registryUrl, projectPath }: ToImporterLabelArgs): string => {
  const packageVersion = toPackageVersion(specifier, registryUrl)
  if (packageVersion) return `${packageVersion.name}@${packageVersion.version}`

  if (specifier.startsWith('file:')) return relative(projectPath, fromFileUrl(specifier))

  return specifier
}

const compareVersions = (left: string, right: string): number => {
  const leftVersion = tryParse(left)
  const rightVersion = tryParse(right)
  if (leftVersion && rightVersion) return compare(leftVersion, rightVersion)
  return left.localeCompare(right)
}

type ToTrackedPackagesArgs = {
  graph: ModuleGraph
  projectPath: string
  /** Registry base URL, no trailing slash. Defaults to `JSR_URL` or jsr.io. */
  registryUrl?: string
}

/**
 * Every `@skmtc/core` and `@skmtc/lang-*` version in the graph, each
 * with the packages that import it. A package imports a copy when one of
 * its modules has a dependency that loads a module of that copy; imports
 * inside the copy itself don't count.
 */
export const toTrackedPackages = ({
  graph,
  projectPath,
  registryUrl = getJsrBaseUrl()
}: ToTrackedPackagesArgs): TrackedPackage[] => {
  const redirects = graph.redirects ?? {}
  const importers = new Map<string, Map<string, Set<string>>>()

  const addImporter = (target: PackageVersion, importer: string) => {
    const versions = importers.get(target.name) ?? new Map<string, Set<string>>()
    const versionImporters = versions.get(target.version) ?? new Set<string>()
    versionImporters.add(importer)
    versions.set(target.version, versionImporters)
    importers.set(target.name, versions)
  }

  for (const module of graph.modules) {
    const source = toPackageVersion(module.specifier, registryUrl)
    const importer = toImporterLabel({ specifier: module.specifier, registryUrl, projectPath })

    for (const dependency of module.dependencies ?? []) {
      const specifier = dependency.code?.specifier ?? dependency.type?.specifier
      if (specifier === undefined) continue

      const target = toPackageVersion(toModuleUrl(specifier, redirects), registryUrl)
      if (!target || !isTrackedPackage(target.name)) continue
      if (source?.name === target.name && source.version === target.version) continue

      addImporter(target, importer)
    }
  }

  return Array.from(importers.entries())
    .map(([name, versions]) => ({
      name,
      copies: Array.from(versions.entries())
        .map(([version, versionImporters]) => ({
          version,
          importedBy: Array.from(versionImporters).sort()
        }))
        .sort((left, right) => compareVersions(left.version, right.version))
    }))
    .sort((left, right) => left.name.localeCompare(right.name))
}

type ToModuleGraphCheckArgs = ToTrackedPackagesArgs

/**
 * Duplicates found in a partly resolved graph are still real; a partly
 * resolved graph without them proves nothing, so it is `unavailable`.
 */
export const toModuleGraphCheck = (args: ToModuleGraphCheckArgs): ModuleGraphCheck => {
  const packages = toTrackedPackages(args)
  const duplicates = packages.filter(trackedPackage => trackedPackage.copies.length > 1)

  if (duplicates.length > 0) return { type: 'duplicates', duplicates }

  const failedModule = args.graph.modules.find(module => module.error !== undefined)
  if (failedModule) {
    return {
      type: 'unavailable',
      reason: `\`deno info\` could not load ${failedModule.specifier}: ${failedModule.error}`
    }
  }

  return { type: 'single-copies', packages }
}

/**
 * Resolves the project's `worker.ts` graph with `deno info --json` and
 * checks it. Never throws: when the graph can't be read the result is
 * `unavailable` and the caller carries on — `deno bundle` reports an
 * unresolvable graph better than this check could.
 */
export const checkModuleGraph: CheckModuleGraphFn = async projectPath => {
  const workerPath = join(projectPath, 'worker.ts')
  if (!existsSync(workerPath)) {
    return { type: 'unavailable', reason: `${workerPath} does not exist yet.` }
  }

  try {
    const { success, stdout, stderr } = await new Deno.Command('deno', {
      args: ['info', '--json', ...toDependencyAgeArgs(), 'worker.ts'],
      cwd: projectPath,
      stdout: 'piped',
      stderr: 'piped'
    }).output()

    if (!success) {
      const errorOutput = new TextDecoder().decode(stderr).trim()
      return { type: 'unavailable', reason: `\`deno info\` failed: ${errorOutput}` }
    }

    const parsed = v.safeParse(moduleGraphSchema, JSON.parse(new TextDecoder().decode(stdout)))
    if (!parsed.success) {
      return { type: 'unavailable', reason: '`deno info --json` output has an unexpected shape.' }
    }

    return toModuleGraphCheck({ graph: parsed.output, projectPath })
  } catch (error) {
    return {
      type: 'unavailable',
      reason: error instanceof Error ? error.message : String(error)
    }
  }
}

const formatCopy = (name: string, copy: PackageCopy): string =>
  `  ${name} ${copy.version} ← ${copy.importedBy.join(', ')}`

type ToDuplicatePackagesMessageArgs = {
  projectName: string
  projectPath: string
  duplicates: TrackedPackage[]
}

export const toDuplicatePackagesMessage = ({
  projectName,
  projectPath,
  duplicates
}: ToDuplicatePackagesMessageArgs): string => {
  const names = duplicates.map(duplicate => duplicate.name).join(', ')

  return [
    `Project "${projectName}" resolves more than one copy of ${names}:`,
    ...duplicates.flatMap(duplicate =>
      duplicate.copies.map(copy => formatCopy(duplicate.name, copy))
    ),
    '',
    "The engine's `instanceof` checks fail across copies, so generation would find nothing " +
      'and write empty files.',
    `Make every package resolve the same version: change the pins in ${join(projectPath, 'deno.json')} ` +
      `so that the packages listed above agree, then run \`skmtc bundle ${projectName}\`.`
  ].join('\n')
}

/** One line per tracked package for a graph with no duplicates. */
export const toSingleCopiesSummary = (packages: TrackedPackage[]): string =>
  packages
    .flatMap(trackedPackage =>
      trackedPackage.copies.map(copy => formatCopy(trackedPackage.name, copy))
    )
    .join('\n')
