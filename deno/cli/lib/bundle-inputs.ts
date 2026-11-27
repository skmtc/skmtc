/**
 * The record of what a project's `bundle.js` was built from, so that
 * `generate` can skip a build whose inputs are the ones already built.
 *
 * The fingerprint is one SHA-256 over everything the bundle is built
 * from, read from disk with no subprocess: the project's `deno.json`
 * and `deno.lock`, `worker.ts`, every file of each workspace member and
 * local-path import, the CLI's version and Deno's version. Nothing in
 * `bundle.js` itself takes part.
 */

import { encodeHex } from '@std/encoding/hex'
import { exists } from '@std/fs/exists'
import { walk } from '@std/fs/walk'
import { dirname } from '@std/path/dirname'
import { fromFileUrl } from '@std/path/from-file-url'
import { join } from '@std/path/join'
import { relative } from '@std/path/relative'
import { resolve } from '@std/path/resolve'
import { SEPARATOR } from '@std/path/constants'
import * as v from 'valibot'
import cliDenoJson from '@/deno.json' with { type: 'json' }
import { toBundleFsPath } from '@/lib/to-bundle-path.ts'

const bundleRecordSchema = v.object({
  fingerprint: v.string(),
  cliVersion: v.string(),
  denoVersion: v.string()
})

/** The contents of `.settings/bundle-inputs.json`. */
export type BundleRecord = v.InferOutput<typeof bundleRecordSchema>

/** The versions that take part in the fingerprint. Tests pass their own. */
export type BundleVersions = {
  cliVersion: string
  denoVersion: string
}

export const toCurrentVersions = (): BundleVersions => ({
  cliVersion: cliDenoJson.version,
  denoVersion: Deno.version.deno
})

/**
 * `sourceDigest` covers every input but `deno.lock`, which a build may
 * write: a build records the inputs read after it only when their
 * `sourceDigest` is the one read before it.
 */
export type BundleInputs =
  | { type: 'fingerprinted'; record: BundleRecord; sourceDigest: string }
  /** The inputs can't prove the bundle current: build every time. */
  | { type: 'unpinned'; reason: string; sourceDigest?: string }

const configSchema = v.object({
  imports: v.optional(v.record(v.string(), v.string())),
  workspace: v.optional(v.array(v.string())),
  lock: v.optional(v.unknown())
})

const lockSchema = v.object({
  specifiers: v.optional(v.record(v.string(), v.string()))
})

export const toBundleRecordPath = (projectPath: string): string =>
  join(projectPath, '.settings', 'bundle-inputs.json')

const registrySpecifierPattern = /^(jsr|npm):\/?((?:@[^/@]+\/)?[^/@]+)(?:@([^/]+))?/

/**
 * The key `deno.lock#specifiers` holds for a `jsr:` or `npm:` import, or
 * `undefined` for any other import: `jsr:@std/path@^1/join` → `jsr:@std/path@^1`.
 */
export const toLockKey = (specifier: string): string | undefined => {
  const match = specifier.match(registrySpecifierPattern)
  if (!match) return undefined
  const [, scheme, name, requirement] = match
  return `${scheme}:${name}@${requirement ?? '*'}`
}

/** The import whose version `deno.lock` doesn't hold, if there is one. */
const findUnlockedImport = (
  imports: Record<string, string>,
  specifiers: Record<string, string>
): string | undefined =>
  Object.values(imports).find(specifier => {
    const key = toLockKey(specifier)
    return key !== undefined && specifiers[key] === undefined
  })

const isLocalPath = (specifier: string): boolean =>
  specifier.startsWith('./') ||
  specifier.startsWith('../') ||
  specifier.startsWith('/') ||
  specifier.startsWith('file:')

const manifestNames = ['deno.json', 'deno.jsonc', 'jsr.json', 'package.json']

/** The nearest folder at or above `directory` that holds a package manifest. */
const findPackageRoot = async (directory: string): Promise<string> => {
  for (const name of manifestNames) {
    if (await exists(join(directory, name), { isFile: true })) return directory
  }
  const parent = dirname(directory)
  return parent === directory ? directory : await findPackageRoot(parent)
}

/**
 * The folder whose files a local-path import can load: the folder itself
 * for a folder, and the package the file belongs to for a file.
 */
const toImportFolder = async (projectPath: string, specifier: string): Promise<string> => {
  const path = specifier.startsWith('file:')
    ? fromFileUrl(specifier)
    : resolve(projectPath, specifier)
  const info = await Deno.stat(path)
  return info.isDirectory ? path : await findPackageRoot(dirname(path))
}

const isInside = (parent: string, child: string): boolean =>
  child === parent || child.startsWith(`${parent}${SEPARATOR}`)

type Chunk = { label: string; bytes: Uint8Array }

const toFolderChunks = async (projectPath: string, folder: string): Promise<Chunk[]> => {
  const chunks: Chunk[] = []
  for await (const entry of walk(folder, {
    includeDirs: false,
    skip: [/[\\/]node_modules([\\/]|$)/]
  })) {
    chunks.push({
      label: `file:${relative(projectPath, entry.path).split(SEPARATOR).join('/')}`,
      bytes: await Deno.readFile(entry.path)
    })
  }
  return chunks
}

const toDigest = async (chunks: Chunk[]): Promise<string> => {
  const encoder = new TextEncoder()
  const parts = chunks.flatMap(({ label, bytes }) => [
    encoder.encode(`${label}\0${bytes.byteLength}\0`),
    bytes
  ])
  const total = new Uint8Array(parts.reduce((sum, part) => sum + part.byteLength, 0))
  parts.reduce((offset, part) => {
    total.set(part, offset)
    return offset + part.byteLength
  }, 0)
  return encodeHex(new Uint8Array(await crypto.subtle.digest('SHA-256', total)))
}

const readOptional = async (path: string): Promise<Uint8Array | undefined> => {
  try {
    return await Deno.readFile(path)
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return undefined
    throw error
  }
}

type ToBundleInputsArgs = {
  projectPath: string
  versions: BundleVersions
}

/**
 * Fingerprints what the project's bundle is built from, after `worker.ts`
 * was written. `unpinned` when the inputs can't prove a bundle current: no
 * `deno.lock`, an import the lock doesn't hold, or a file that can't be read.
 */
export const toBundleInputs = async ({
  projectPath,
  versions
}: ToBundleInputsArgs): Promise<BundleInputs> => {
  try {
    const decoder = new TextDecoder()
    const denoJsonBytes = await Deno.readFile(join(projectPath, 'deno.json'))
    const config = v.parse(configSchema, JSON.parse(decoder.decode(denoJsonBytes)))

    const workspace = config.workspace ?? []
    if (workspace.some(member => member.includes('*'))) {
      return { type: 'unpinned', reason: 'deno.json#workspace names a pattern.' }
    }

    const workspaceFolders = workspace.map(member => resolve(projectPath, member))
    const importFolders = await Promise.all(
      Object.values(config.imports ?? {})
        .filter(isLocalPath)
        .map(specifier => toImportFolder(projectPath, specifier))
    )
    const folders = Array.from(new Set([...workspaceFolders, ...importFolders]))

    const resolvedProjectPath = resolve(projectPath)
    const enclosing = folders.find(folder => isInside(folder, resolvedProjectPath))
    if (enclosing !== undefined) {
      return {
        type: 'unpinned',
        reason: `a local import loads from ${enclosing}, which holds the project.`
      }
    }

    const folderChunks = (
      await Promise.all(folders.map(folder => toFolderChunks(projectPath, folder)))
    ).flat()
    const files = Array.from(
      new Map(folderChunks.map(chunk => [chunk.label, chunk])).values()
    ).sort((left, right) => (left.label < right.label ? -1 : left.label > right.label ? 1 : 0))

    const encoder = new TextEncoder()
    const denoJsonChunk = { label: 'deno.json', bytes: denoJsonBytes }
    const otherChunks = [
      { label: 'worker.ts', bytes: await Deno.readFile(join(projectPath, 'worker.ts')) },
      ...files,
      { label: 'cli', bytes: encoder.encode(versions.cliVersion) },
      { label: 'deno', bytes: encoder.encode(versions.denoVersion) }
    ]
    const sourceDigest = await toDigest([denoJsonChunk, ...otherChunks])

    if (config.lock !== undefined && config.lock !== true) {
      return { type: 'unpinned', reason: 'deno.json sets `lock`.', sourceDigest }
    }

    const lockBytes = await readOptional(join(projectPath, 'deno.lock'))
    if (lockBytes === undefined) {
      return { type: 'unpinned', reason: 'the project has no deno.lock.', sourceDigest }
    }
    const specifiers = v.parse(lockSchema, JSON.parse(decoder.decode(lockBytes))).specifiers ?? {}

    const memberImports = await Promise.all(
      workspaceFolders.map(async folder => {
        const bytes = await readOptional(join(folder, 'deno.json'))
        return bytes === undefined
          ? {}
          : (v.parse(configSchema, JSON.parse(decoder.decode(bytes))).imports ?? {})
      })
    )
    const unlocked = [config.imports ?? {}, ...memberImports]
      .map(imports => findUnlockedImport(imports, specifiers))
      .find(specifier => specifier !== undefined)
    if (unlocked !== undefined) {
      return { type: 'unpinned', reason: `deno.lock does not hold ${unlocked}.`, sourceDigest }
    }

    const fingerprint = await toDigest([
      denoJsonChunk,
      { label: 'deno.lock', bytes: lockBytes },
      ...otherChunks
    ])

    return { type: 'fingerprinted', record: { fingerprint, ...versions }, sourceDigest }
  } catch (error) {
    return {
      type: 'unpinned',
      reason: `the inputs could not be read: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

/** The record on disk, or `undefined` when it is missing or can't be read. */
export const readBundleRecord = async (projectPath: string): Promise<BundleRecord | undefined> => {
  try {
    const parsed = v.safeParse(
      bundleRecordSchema,
      JSON.parse(await Deno.readTextFile(toBundleRecordPath(projectPath)))
    )
    return parsed.success ? parsed.output : undefined
  } catch {
    return undefined
  }
}

type IsBundleCurrentArgs = {
  projectPath: string
  inputs: BundleInputs
}

/** True when `bundle.js` is there and the record says it was built from `inputs`. */
export const isBundleCurrent = async ({
  projectPath,
  inputs
}: IsBundleCurrentArgs): Promise<boolean> => {
  if (inputs.type !== 'fingerprinted') return false
  if (!(await exists(toBundleFsPath(projectPath), { isFile: true }))) return false
  const record = await readBundleRecord(projectPath)
  return record?.fingerprint === inputs.record.fingerprint
}

/** Deletes the record, before `bundle.js` is replaced. */
export const removeBundleRecord = async (projectPath: string): Promise<void> => {
  try {
    await Deno.remove(toBundleRecordPath(projectPath))
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error
  }
}

/** Writes the record by a rename, so a reader never sees half of it. */
export const writeBundleRecord = async (
  projectPath: string,
  record: BundleRecord
): Promise<void> => {
  const recordPath = toBundleRecordPath(projectPath)
  const temporaryPath = join(dirname(recordPath), `.write-${crypto.randomUUID()}`)
  await Deno.writeTextFile(temporaryPath, `${JSON.stringify(record, null, 2)}\n`)
  await Deno.rename(temporaryPath, recordPath)
}
