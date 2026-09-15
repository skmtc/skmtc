#!/usr/bin/env -S deno run --allow-read --allow-write --allow-env --allow-run=deno
/**
 * The public API surface of the packages the published skills describe,
 * recorded as one digest per export.
 *
 * The declared-version gate (verify-docs check 16 and the release
 * refusal) fires when a package MINOR moves past what a skill declares.
 * It cannot fire when a public API change ships as a patch: every skill
 * keeps its number and nobody rereads it. Caller options on core 0.28.x
 * shipped exactly that way.
 *
 * This record closes most of the hole. `deno doc --json` over each
 * package's `mod.ts` gives every export's declaration; positions and doc
 * comments are dropped and the rest is hashed per export. verify-docs
 * recomputes the digests and compares them with the record. An export
 * added, removed or re-shaped while the minor stayed put is a public API
 * change nobody declared. The fix is the minor bump (`deno task bump
 * <package> --minor`), which makes check 16 demand a reread of every
 * skill that describes the package, and then `deno task
 * record-api-surface`.
 *
 * Blind spot, stated so a green check is not read as more than it is: a
 * factory that returns an anonymous class (`toModelProjectionBase` and
 * its siblings, the lang veneers) has no return type in `deno doc`, so
 * the class it returns — `insertModel`, `insertOperation`, `register`,
 * `this.options` — never enters the digest. Those exports are listed in
 * the record as `unresolved`; a change to what they return is caught by
 * the declared-version gate only when someone bumps the minor.
 *
 * Run from `deno/`: `deno task record-api-surface`.
 */

import { dirname, fromFileUrl, join } from 'jsr:@std/path@^1'
import { encodeHex } from '@std/encoding/hex'

export type SurfaceTarget = { packageName: string; directory: string }

/** The packages a published skill declares in `metadata.describes`. */
export const surfaceTargets: SurfaceTarget[] = [
  { packageName: '@skmtc/core', directory: 'core' },
  { packageName: '@skmtc/lang-typescript', directory: 'lang-typescript' }
]

export type ApiSurface = {
  /** The package minor the surface was recorded on. */
  minor: string
  /** The `deno` that produced the digests. A `deno doc` format shift moves digests without an API change. */
  deno: string
  /** Export name to the digest of its declarations, positions and doc comments removed. */
  exports: Record<string, string>
  /** Exports whose type `deno doc` could not resolve — recorded by signature only, see the file header. */
  unresolved: string[]
}

export type ApiSurfaceRecord = Record<string, ApiSurface>

export type ApiSurfaceDiff = { added: string[]; removed: string[]; changed: string[] }

const DROPPED_KEYS = new Set(['location', 'jsDoc'])

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const toMinor = (version: string): string => version.split('.').slice(0, 2).join('.')

/** Whether a parsed record entry has the shape {@link ApiSurface}. */
export const isApiSurface = (value: unknown): value is ApiSurface =>
  isRecord(value) &&
  typeof value.minor === 'string' &&
  typeof value.deno === 'string' &&
  isRecord(value.exports) &&
  Object.values(value.exports).every(digest => typeof digest === 'string') &&
  Array.isArray(value.unresolved) &&
  value.unresolved.every(name => typeof name === 'string')

/**
 * Drop positions and doc comments and sort keys, so the digest is a
 * function of the declaration alone: moving a file or editing a comment
 * is not an API change.
 */
export const normalizeDeclaration = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(normalizeDeclaration)
  if (!isRecord(value)) return value

  return Object.fromEntries(
    Object.keys(value)
      .filter(key => !DROPPED_KEYS.has(key))
      .sort()
      .map(key => [key, normalizeDeclaration(value[key])])
  )
}

const digest = async (value: unknown): Promise<string> => {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  return encodeHex(await crypto.subtle.digest('SHA-256', bytes)).slice(0, 16)
}

/**
 * A function whose return type, or a variable whose type, `deno doc`
 * left out: the digest covers the signature but not what it produces.
 */
const isUnresolved = (declaration: Record<string, unknown>): boolean => {
  const def = declaration.def
  if (!isRecord(def)) return false
  if (declaration.kind === 'function') return def.returnType == null
  if (declaration.kind === 'variable') return def.tsType == null
  return false
}

/**
 * Every exported declaration in a `deno doc --json` document, by export
 * name. The walk looks for `symbols` arrays wherever they sit, so the
 * module-level shape can shift between deno versions without emptying
 * the result. Private declarations and re-exported imports are dropped.
 */
export const collectExports = (document: unknown): Map<string, Record<string, unknown>[]> => {
  const into = new Map<string, Record<string, unknown>[]>()

  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(walk)
      return
    }
    if (!isRecord(value)) return

    const symbols = value.symbols
    if (Array.isArray(symbols)) {
      for (const symbol of symbols) {
        if (!isRecord(symbol) || typeof symbol.name !== 'string') continue
        const declarations = Array.isArray(symbol.declarations) ? symbol.declarations : []
        const exported = declarations.filter(
          (declaration): declaration is Record<string, unknown> =>
            isRecord(declaration) &&
            declaration.declarationKind !== 'private' &&
            declaration.kind !== 'import'
        )
        if (exported.length === 0) continue
        into.set(symbol.name, [...(into.get(symbol.name) ?? []), ...exported])
      }
    }

    Object.values(value).forEach(walk)
  }

  walk(document)
  return into
}

const decoder = new TextDecoder()

const runDeno = async (args: string[]): Promise<string> => {
  const output = await new Deno.Command('deno', { args, stdout: 'piped', stderr: 'piped' }).output()
  if (!output.success) {
    throw new Error(`deno ${args.join(' ')} failed: ${decoder.decode(output.stderr).slice(0, 300)}`)
  }
  return decoder.decode(output.stdout)
}

/**
 * The version of the `deno` the digests come from — asked of the spawned
 * binary itself, not `Deno.version` of this process, so the record
 * describes the tool that produced it even under a version-manager shim.
 */
const spawnedDenoVersion = async (): Promise<string> => {
  const firstLine = (await runDeno(['--version'])).split('\n')[0]
  const match = firstLine.match(/^deno (\S+)/)
  if (!match) throw new Error(`could not read a version from \`deno --version\`: ${firstLine}`)
  return match[1]
}

export const computeApiSurface = async (
  denoDir: string,
  target: SurfaceTarget
): Promise<ApiSurface> => {
  const [documentText, denoVersion, denoJson] = await Promise.all([
    runDeno(['doc', '--json', join(denoDir, target.directory, 'mod.ts')]),
    spawnedDenoVersion(),
    Deno.readTextFile(join(denoDir, target.directory, 'deno.json'))
  ])

  const declarationsByName = collectExports(JSON.parse(documentText))
  if (declarationsByName.size === 0) {
    throw new Error(`extracted zero exports from ${target.directory}/mod.ts`)
  }

  const names = [...declarationsByName.keys()].sort()
  const digests = await Promise.all(
    names.map(name => digest(normalizeDeclaration(declarationsByName.get(name))))
  )
  const exports = Object.fromEntries(names.map((name, index) => [name, digests[index]]))
  const unresolved = names.filter(name => (declarationsByName.get(name) ?? []).some(isUnresolved))

  const { version } = JSON.parse(denoJson)

  return { minor: toMinor(version), deno: denoVersion, exports, unresolved }
}

export const diffApiSurface = (
  recorded: Record<string, string>,
  current: Record<string, string>
): ApiSurfaceDiff => ({
  added: Object.keys(current).filter(name => !(name in recorded)),
  removed: Object.keys(recorded).filter(name => !(name in current)),
  changed: Object.keys(current).filter(name => name in recorded && recorded[name] !== current[name])
})

export const recordPath = (denoDir: string): string => join(denoDir, '.scripts', 'api-surface.json')

if (import.meta.main) {
  const denoDir = join(dirname(fromFileUrl(import.meta.url)), '..')
  const surfaces = await Promise.all(
    surfaceTargets.map(async target => [target, await computeApiSurface(denoDir, target)] as const)
  )
  const record: ApiSurfaceRecord = Object.fromEntries(
    surfaces.map(([target, surface]) => [target.packageName, surface])
  )

  for (const [target, surface] of surfaces) {
    const count = Object.keys(surface.exports).length
    console.log(
      `${target.packageName} ${surface.minor}: ${count} exports recorded ` +
        `(${surface.unresolved.length} by signature only), deno ${surface.deno}`
    )
  }

  await Deno.writeTextFile(recordPath(denoDir), `${JSON.stringify(record, null, 2)}\n`)
  console.log('wrote .scripts/api-surface.json — commit it with the change that moved the surface')
}
