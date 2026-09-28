/**
 * Detects more than one copy of `@skmtc/core` or a `@skmtc/lang-*`
 * package in a project.
 *
 * The engine recognizes definitions, files and snippets with
 * `instanceof`. Across two copies of core those checks fail, so a run
 * finds nothing, writes empty files and still reports success.
 *
 * The check reads the module graph `deno info` resolves for `worker.ts`
 * — what `deno bundle` will build. It names the packages that import
 * each copy. Every bundle build runs it, and so does `doctor`.
 */

import { dirname } from '@std/path/dirname'
import { join } from '@std/path/join'
import { relative } from '@std/path/relative'
import { SEPARATOR } from '@std/path/constants'
import { fromFileUrl } from '@std/path/from-file-url'
import { existsSync } from '@std/fs/exists'
import { compare } from '@std/semver/compare'
import { tryParse } from '@std/semver/try-parse'
import * as v from 'valibot'
import { toDependencyAgeArgs } from '@/lib/dependency-age.ts'

/** A resolved or failed import — failed ones carry `error` and no `specifier`. */
const dependencyTarget = v.object({
  specifier: v.optional(v.string()),
  error: v.optional(v.string())
})

const moduleGraphSchema = v.object({
  modules: v.array(
    v.object({
      specifier: v.string(),
      /** Set when the module failed to load — `deno info` still exits 0. */
      error: v.optional(v.string()),
      dependencies: v.optional(
        v.array(
          v.object({
            specifier: v.optional(v.string()),
            /** Runtime import. `import type` edges only carry `type`, and `deno bundle` erases them. */
            code: v.optional(dependencyTarget)
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
  /**
   * The version, plus where the copy comes from when that isn't a JSR
   * registry: `0.29.0`, `0.29.0 (npm)`, `0.29.0 (../../core)`.
   */
  version: string
  /** Packages and project directories that import this copy directly. */
  importedBy: string[]
}

export type TrackedPackage = {
  /** `@skmtc/core` or a `@skmtc/lang-*` package. */
  name: string
  /** One entry per copy, oldest version first. */
  copies: PackageCopy[]
}

export type PackageCopiesCheck =
  | {
      type: 'single-copies'
      /** Every tracked package found — each with one copy. */
      packages: TrackedPackage[]
    }
  | {
      type: 'duplicates'
      /** Tracked packages with more than one copy. */
      duplicates: TrackedPackage[]
    }
  | {
      /** Nothing to read, or nothing that proves a single copy. */
      type: 'unavailable'
      reason: string
    }

type CheckModuleGraphOptions = {
  /**
   * Pass `--frozen`: never write `deno.lock`, and report `unavailable`
   * when `deno.json` no longer matches it. For read-only diagnostics.
   */
  frozen?: boolean
  /** Give up on `deno info` after this long, e.g. on a cold cache with no network. */
  timeoutMs?: number
}

export type CheckModuleGraphFn = (
  projectPath: string,
  options?: CheckModuleGraphOptions
) => Promise<PackageCopiesCheck>

const isTrackedPackage = (name: string): boolean =>
  name === '@skmtc/core' || name.startsWith('@skmtc/lang-')

/** `…/@scope/name/1.2.3/…` (JSR, npm cache) or `…/@scope/name@1.2.3/…` (esm.sh-style CDNs). */
const packagePathPattern = /\/(@[\w.-]+)\/([\w.-]+)[/@](\d+\.\d+\.\d+[\w.+-]*)\//

const npmSpecifierPattern = /^npm:\/?((?:@[^/@]+\/)?[^/@]+)@([^/]+)/

type PackageManifest = {
  name?: string
  version?: string
}

/** Reads the package manifest in `directory`, if there is one. */
export type ReadManifestFn = (directory: string) => PackageManifest | undefined

const manifestFileNames = ['deno.json', 'jsr.json', 'package.json']

const readManifestFromDisk: ReadManifestFn = directory => {
  for (const fileName of manifestFileNames) {
    const path = join(directory, fileName)
    if (!existsSync(path)) continue
    try {
      const parsed: unknown = JSON.parse(Deno.readTextFileSync(path))
      if (!parsed || typeof parsed !== 'object') return {}
      const name = 'name' in parsed && typeof parsed.name === 'string' ? parsed.name : undefined
      const version =
        'version' in parsed && typeof parsed.version === 'string' ? parsed.version : undefined
      return { name, version }
    } catch {
      return {}
    }
  }
  return undefined
}

/** How a module is named in messages, and the copy it belongs to. */
type ModuleIdentity = {
  /** Set when the module belongs to a named package. */
  packageName?: string
  /** Version column for a tracked package, see {@link PackageCopy.version}. */
  copy: string
  /** How the module appears in an `importedBy` list. */
  label: string
}

type ToIdentityContext = {
  /** Canonical (real) path of the project directory. */
  projectPath: string
  readManifest: ReadManifestFn
  manifestCache: Map<string, { directory: string; manifest: PackageManifest } | undefined>
}

const isInside = (parent: string, child: string): boolean =>
  child === parent || child.startsWith(`${parent}${SEPARATOR}`)

/**
 * The named package a local file belongs to: the nearest directory with
 * a manifest that has a `name`. Files inside the project stop at the
 * project directory, whose `deno.json` never has one.
 */
const findLocalPackage = (
  directory: string,
  context: ToIdentityContext
): { directory: string; manifest: PackageManifest } | undefined => {
  if (context.manifestCache.has(directory)) return context.manifestCache.get(directory)

  const manifest = context.readManifest(directory)
  const parent = dirname(directory)
  const atBoundary =
    directory === context.projectPath || parent === directory || manifest?.name !== undefined

  const found =
    manifest?.name !== undefined
      ? { directory, manifest }
      : atBoundary
        ? undefined
        : findLocalPackage(parent, context)

  context.manifestCache.set(directory, found)
  return found
}

const toLocalIdentity = (specifier: string, context: ToIdentityContext): ModuleIdentity => {
  const path = fromFileUrl(specifier)
  const localPackage = findLocalPackage(dirname(path), context)

  if (localPackage?.manifest.name) {
    const where = relative(context.projectPath, localPackage.directory) || '.'
    return {
      packageName: localPackage.manifest.name,
      copy: `${localPackage.manifest.version ?? 'unversioned'} (${where})`,
      label: `${localPackage.manifest.name} (${where})`
    }
  }

  // Unnamed project files are grouped by their top-level entry — one
  // label per cloned generator directory, not one per source file.
  const relativePath = relative(context.projectPath, path)
  const label = isInside(context.projectPath, path)
    ? relativePath.split(SEPARATOR)[0]
    : relative(context.projectPath, dirname(path))
  return { copy: label, label }
}

const toModuleIdentity = (specifier: string, context: ToIdentityContext): ModuleIdentity => {
  if (specifier.startsWith('file:')) return toLocalIdentity(specifier, context)

  const npmMatch = specifier.match(npmSpecifierPattern)
  if (npmMatch) {
    const [, packageName, version] = npmMatch
    return { packageName, copy: `${version} (npm)`, label: `npm:${packageName}@${version}` }
  }

  const pathMatch = specifier.startsWith('http') ? specifier.match(packagePathPattern) : null
  if (pathMatch) {
    const [, scope, name, version] = pathMatch
    const packageName = `${scope}/${name}`
    return { packageName, copy: version, label: `${packageName}@${version}` }
  }

  return { copy: specifier, label: specifier }
}

/** Follows `jsr:` / `npm:` specifiers to the module they load. */
const toModuleSpecifier = (
  specifier: string,
  redirects: Record<string, string>,
  seen: ReadonlySet<string> = new Set()
): string => {
  const next = redirects[specifier]
  if (next === undefined || seen.has(specifier)) return specifier
  return toModuleSpecifier(next, redirects, new Set(seen).add(specifier))
}

const compareCopies = (left: PackageCopy, right: PackageCopy): number => {
  const leftVersion = tryParse(left.version.split(' ')[0])
  const rightVersion = tryParse(right.version.split(' ')[0])
  const byVersion = leftVersion && rightVersion ? compare(leftVersion, rightVersion) : 0
  return byVersion !== 0 ? byVersion : left.version.localeCompare(right.version)
}

/** name → copy → importers */
type CopyIndex = Map<string, Map<string, Set<string>>>

const addCopy = (index: CopyIndex, name: string, copy: string, importer?: string) => {
  const copies = index.get(name) ?? new Map<string, Set<string>>()
  const importers = copies.get(copy) ?? new Set<string>()
  if (importer !== undefined) importers.add(importer)
  copies.set(copy, importers)
  index.set(name, copies)
}

const toCheck = (index: CopyIndex, emptyReason: string): PackageCopiesCheck => {
  const packages: TrackedPackage[] = Array.from(index.entries())
    .map(([name, copies]) => ({
      name,
      copies: Array.from(copies.entries())
        .map(([version, importers]) => ({ version, importedBy: Array.from(importers).sort() }))
        .sort(compareCopies)
    }))
    .sort((left, right) => left.name.localeCompare(right.name))

  if (packages.length === 0) return { type: 'unavailable', reason: emptyReason }

  const duplicates = packages.filter(trackedPackage => trackedPackage.copies.length > 1)
  return duplicates.length > 0
    ? { type: 'duplicates', duplicates }
    : { type: 'single-copies', packages }
}

type ToModuleGraphCheckArgs = {
  graph: ModuleGraph
  /** Canonical (real) path of the project directory. */
  projectPath: string
  readManifest?: ReadManifestFn
}

/**
 * Every `@skmtc/core` and `@skmtc/lang-*` copy in the graph, each with
 * the packages that import it at runtime. Copies are told apart by
 * version and by origin (JSR or another host, npm, a local directory).
 *
 * Duplicates found in a partly resolved graph are still real; a partly
 * resolved graph without them proves nothing, so it is `unavailable`.
 */
export const toModuleGraphCheck = ({
  graph,
  projectPath,
  readManifest = readManifestFromDisk
}: ToModuleGraphCheckArgs): PackageCopiesCheck => {
  const redirects = graph.redirects ?? {}
  const context: ToIdentityContext = { projectPath, readManifest, manifestCache: new Map() }
  const index: CopyIndex = new Map()

  for (const module of graph.modules) {
    const source = toModuleIdentity(module.specifier, context)

    for (const dependency of module.dependencies ?? []) {
      const specifier = dependency.code?.specifier
      if (specifier === undefined) continue

      const target = toModuleIdentity(toModuleSpecifier(specifier, redirects), context)
      if (!target.packageName || !isTrackedPackage(target.packageName)) continue
      if (source.packageName === target.packageName && source.copy === target.copy) continue

      addCopy(index, target.packageName, target.copy, source.label)
    }
  }

  const check = toCheck(index, 'the module graph holds no @skmtc/core or @skmtc/lang-* module.')
  if (check.type === 'duplicates') return check

  const failedModule = graph.modules.find(module => module.error !== undefined)
  if (failedModule) {
    return {
      type: 'unavailable',
      reason: `\`deno info\` could not load ${failedModule.specifier}: ${failedModule.error}`
    }
  }

  const failedImport = graph.modules
    .flatMap(module => module.dependencies ?? [])
    .find(dependency => dependency.code?.error !== undefined)
  if (failedImport) {
    return {
      type: 'unavailable',
      reason: `\`deno info\` could not resolve "${failedImport.specifier}": ${failedImport.code?.error}`
    }
  }

  return check
}

const toCanonicalPath = (path: string): string => {
  try {
    return Deno.realPathSync(path)
  } catch {
    return path
  }
}

const lockfileOutOfDate = 'The lockfile is out of date'

/**
 * Resolves the project's `worker.ts` graph with `deno info --json` and
 * checks it. Never throws: when the graph can't be read the result is
 * `unavailable` and the caller carries on — `deno bundle` reports an
 * unresolvable graph better than this check could.
 */
export const checkModuleGraph: CheckModuleGraphFn = async (projectPath, options = {}) => {
  const workerPath = join(projectPath, 'worker.ts')
  if (!existsSync(workerPath)) {
    return { type: 'unavailable', reason: `${workerPath} does not exist yet.` }
  }

  const signal =
    options.timeoutMs === undefined ? undefined : AbortSignal.timeout(options.timeoutMs)

  try {
    const { success, stdout, stderr } = await new Deno.Command('deno', {
      args: [
        'info',
        '--json',
        ...(options.frozen ? ['--frozen'] : []),
        ...toDependencyAgeArgs(),
        'worker.ts'
      ],
      cwd: projectPath,
      stdout: 'piped',
      stderr: 'piped',
      signal
    }).output()

    if (signal?.aborted) {
      return {
        type: 'unavailable',
        reason: `\`deno info\` took longer than ${options.timeoutMs}ms.`
      }
    }

    if (!success) {
      const errorOutput = new TextDecoder().decode(stderr).trim()
      return {
        type: 'unavailable',
        reason: errorOutput.includes(lockfileOutOfDate)
          ? 'deno.json no longer matches deno.lock — the pins changed since the last build.'
          : `\`deno info\` failed: ${errorOutput}`
      }
    }

    const parsed = v.safeParse(moduleGraphSchema, JSON.parse(new TextDecoder().decode(stdout)))
    if (!parsed.success) {
      return { type: 'unavailable', reason: '`deno info --json` output has an unexpected shape.' }
    }

    return toModuleGraphCheck({ graph: parsed.output, projectPath: toCanonicalPath(projectPath) })
  } catch (error) {
    return {
      type: 'unavailable',
      reason: signal?.aborted
        ? `\`deno info\` took longer than ${options.timeoutMs}ms.`
        : error instanceof Error
          ? error.message
          : String(error)
    }
  }
}

const formatCopy = (name: string, copy: PackageCopy): string =>
  copy.importedBy.length > 0
    ? `  ${name} ${copy.version} ← ${copy.importedBy.join(', ')}`
    : `  ${name} ${copy.version}`

/** One line per copy, indented. */
export const toCopiesLines = (packages: TrackedPackage[]): string =>
  packages
    .flatMap(trackedPackage =>
      trackedPackage.copies.map(copy => formatCopy(trackedPackage.name, copy))
    )
    .join('\n')

const toNames = (duplicates: TrackedPackage[]): string =>
  duplicates.map(duplicate => duplicate.name).join(', ')

export const emptyFilesExplanation =
  "The engine's `instanceof` checks fail across copies, so generation would find nothing " +
  'and write empty files.'

type ToGraphFixHintArgs = {
  projectName: string
  projectPath: string
}

export const toGraphFixHint = ({ projectName, projectPath }: ToGraphFixHintArgs): string =>
  `Make every package resolve the same version: change the pins in ${join(projectPath, 'deno.json')} ` +
  `so that the packages listed above agree, then run \`skmtc generate ${projectName}\` again.`

type ToDuplicatesMessageArgs = {
  projectName: string
  projectPath: string
  duplicates: TrackedPackage[]
}

/** For a module graph with duplicates (every bundle build, `generate --debug`). */
export const toDuplicatePackagesMessage = ({
  projectName,
  projectPath,
  duplicates
}: ToDuplicatesMessageArgs): string =>
  [
    `Project "${projectName}" resolves more than one copy of ${toNames(duplicates)}:`,
    toCopiesLines(duplicates),
    '',
    emptyFilesExplanation,
    toGraphFixHint({ projectName, projectPath })
  ].join('\n')

type ToGraphRefusalArgs = {
  projectName: string
  projectPath: string
}

/**
 * The refusal for a project whose module graph holds two copies, or
 * `undefined` when it doesn't (or can't be read). Shared by every bundle
 * build and `generate --debug`, which both run the graph.
 */
export const toGraphRefusal = async ({
  projectName,
  projectPath
}: ToGraphRefusalArgs): Promise<string | undefined> => {
  const graphCheck = await checkModuleGraph(projectPath)
  return graphCheck.type === 'duplicates'
    ? toDuplicatePackagesMessage({ projectName, projectPath, duplicates: graphCheck.duplicates })
    : undefined
}
