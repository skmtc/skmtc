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
 * This record closes the hole. `deno doc --json` over each package's
 * `mod.ts` gives every export's declaration; positions and doc comments
 * are dropped and the rest is hashed per export. verify-docs recomputes
 * the digests and compares them with the record. An export added,
 * removed or re-shaped while the minor stayed put is a public API change
 * nobody declared. The fix is the minor bump (`deno task bump <package>
 * --minor`), which makes check 16 demand a reread of every skill that
 * describes the package, and then `deno task record-api-surface`.
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
  /** The deno that wrote the record. A `deno doc` format shift moves every digest at once. */
  deno: string
  /** Export name to the digest of its declarations, positions and doc comments removed. */
  exports: Record<string, string>
}

export type ApiSurfaceRecord = Record<string, ApiSurface>

export type ApiSurfaceDiff = { added: string[]; removed: string[]; changed: string[] }

const DROPPED_KEYS = new Set(['location', 'jsDoc'])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

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
 * Every exported declaration in a `deno doc --json` document, by export
 * name. The walk looks for `symbols` arrays wherever they sit, so the
 * module-level shape can shift between deno versions without emptying
 * the result.
 */
const collectExports = (value: unknown, into: Map<string, unknown[]>): void => {
  if (Array.isArray(value)) {
    value.forEach(item => collectExports(item, into))
    return
  }
  if (!isRecord(value)) return

  const symbols = value.symbols
  if (Array.isArray(symbols)) {
    for (const symbol of symbols) {
      if (!isRecord(symbol) || typeof symbol.name !== 'string') continue
      const declarations = Array.isArray(symbol.declarations) ? symbol.declarations : []
      const exported = declarations.filter(
        declaration =>
          isRecord(declaration) &&
          declaration.declarationKind !== 'private' &&
          declaration.kind !== 'import'
      )
      if (exported.length === 0) continue
      into.set(symbol.name, [...(into.get(symbol.name) ?? []), ...exported])
    }
  }

  for (const child of Object.values(value)) collectExports(child, into)
}

export const toMinor = (version: string): string => version.split('.').slice(0, 2).join('.')

export const computeApiSurface = async (
  denoDir: string,
  target: SurfaceTarget
): Promise<ApiSurface> => {
  const output = await new Deno.Command('deno', {
    args: ['doc', '--json', join(denoDir, target.directory, 'mod.ts')],
    stdout: 'piped',
    stderr: 'piped'
  }).output()
  const decoder = new TextDecoder()
  if (!output.success) {
    throw new Error(
      `deno doc --json ${target.directory}/mod.ts failed: ${decoder.decode(output.stderr).slice(0, 300)}`
    )
  }

  const declarationsByName = new Map<string, unknown[]>()
  collectExports(JSON.parse(decoder.decode(output.stdout)), declarationsByName)
  if (declarationsByName.size === 0) {
    throw new Error(`extracted zero exports from ${target.directory}/mod.ts`)
  }

  const exports: Record<string, string> = {}
  for (const name of [...declarationsByName.keys()].sort()) {
    exports[name] = await digest(normalizeDeclaration(declarationsByName.get(name)))
  }

  const { version } = JSON.parse(
    await Deno.readTextFile(join(denoDir, target.directory, 'deno.json'))
  )

  return { minor: toMinor(version), deno: Deno.version.deno, exports }
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
  const record: ApiSurfaceRecord = {}

  for (const target of surfaceTargets) {
    record[target.packageName] = await computeApiSurface(denoDir, target)
    const count = Object.keys(record[target.packageName].exports).length
    console.log(`${target.packageName} ${record[target.packageName].minor}: ${count} exports recorded`)
  }

  await Deno.writeTextFile(recordPath(denoDir), `${JSON.stringify(record, null, 2)}\n`)
  console.log('wrote .scripts/api-surface.json — commit it with the change that moved the surface')
}
