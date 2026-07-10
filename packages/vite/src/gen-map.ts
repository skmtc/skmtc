// Decode the attribution sidecars from the last `--anchors` generate
// (`.skmtc/<project>/.maps/**/*.skm.json`) into flat gen-map entries — the
// same shape the hub's run gen-map endpoint serves — for the desktop code
// panel's attribution overlay.
//
// Ported from skmtc-hub `apps/service/src/lib/gen-map-readers.ts`
// (`sidecarsToGenMapEntries`), adapted for the local working tree: generator
// pools carry real package names (no bundle-key resolution), `variant` is
// included from the `V` pool, and per-file span alignment against the on-disk
// artifact is reported (a project-side formatter rewrites the raw engine
// render, invalidating every span in that file until the next raw generate).
//
// Like the hub reader, the sidecar shape is hand-mirrored with defensive
// narrowing rather than imported from `@skmtc/core` — malformed sidecars and
// out-of-range pool indices degrade to empty strings, never throw.

import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { readManifestFiles } from './artifacts.ts'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/** One attributed span — the hub's contract `GenMapEntry`, plus `variant`. */
export type GenMapEntry = {
  /** Manifest-keyed artifact path (`src/...`), realigned from the sidecar's
   *  `@/`-aliased form. */
  artifactPath: string
  /** `[from, to)` span in UTF-16 code units — CodeMirror positions. */
  artifactSpan: [number, number]
  /** Enclosing Projection/Definition name (the `L` pool). */
  projectionName: string
  /** Exact emitting Projection/Snippet class (the `N` pool). */
  producerName: string
  /** Generator package name (the `G` pool) — `''`/`<unknown>` when the
   *  snippet didn't thread its generator. */
  generatorRef: string
  /** JSON pointer into the source schema; `''` when not captured. */
  schemaPointer: string
  /** Enrichment variant the span belongs to (the `V` pool); `'main'` default. */
  variant: string
}

export type GenMapResult = {
  entries: GenMapEntry[]
  /** Manifest files whose on-disk length no longer matches the engine render
   *  (`manifest.characters`) — their spans are stale (e.g. the project ran a
   *  formatter after generate) and must not be decorated. */
  staleFiles: string[]
}

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((entry) => (typeof entry === 'string' ? entry : '')) : []

/** The `G` pool holds `{ name, version, r }` records; only `name` is used —
 *  locally it is the generator's real package name. */
const asGeneratorNames = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.map((entry) =>
        isRecord(entry) && typeof entry.name === 'string' ? entry.name : ''
      )
    : []

const asNumberArray = (value: unknown): number[] =>
  Array.isArray(value) ? value.map((entry) => (typeof entry === 'number' ? entry : -1)) : []

type SidecarLike = {
  /** `@/`-aliased artifact path the sidecar describes. */
  f: string
  G: string[]
  S: string[]
  V: string[]
  L: string[]
  /** Anchor rows: `[Li, Pi, gi, si, vi, from, to]`. */
  A: number[][]
  N: string[]
  /** Parallel to `A` — `An[i]` indexes into `N` for `A[i]`. */
  An: number[]
}

const toSidecar = (value: unknown): SidecarLike | null => {
  if (!isRecord(value) || typeof value.f !== 'string') return null
  const anchors = Array.isArray(value.A)
    ? value.A.filter(
        (row): row is number[] => Array.isArray(row) && row.every((n) => typeof n === 'number')
      )
    : []
  return {
    f: value.f,
    G: asGeneratorNames(value.G),
    S: asStringArray(value.S),
    V: asStringArray(value.V),
    L: asStringArray(value.L),
    A: anchors,
    N: asStringArray(value.N),
    An: asNumberArray(value.An)
  }
}

/** Realign a sidecar's `@/`-aliased path to the manifest's basePath-rooted
 *  form (`@/forms/Foo.tsx` → `src/forms/Foo.tsx`). With the engine's
 *  root-relative fallback (`basePath` absent → `'.'`) manifest keys carry no
 *  prefix, so the alias is simply stripped. */
const resolveAliasPath = (path: string, basePath: string): string => {
  if (!path.startsWith('@/')) return path
  const trimmed = basePath.replace(/\/+$/, '')
  if (trimmed === '' || trimmed === '.') return path.slice(2)
  return `${trimmed}/${path.slice(2)}`
}

const sidecarToEntries = (sidecar: SidecarLike, artifactPath: string): GenMapEntry[] =>
  sidecar.A.map((row, index) => {
    const [li, , gi, si, vi, from, to] = row
    const producerIndex = sidecar.An[index]
    return {
      artifactPath,
      artifactSpan: [from ?? 0, to ?? 0],
      projectionName: (li !== undefined ? sidecar.L[li] : undefined) ?? '',
      producerName: (producerIndex !== undefined ? sidecar.N[producerIndex] : undefined) ?? '',
      generatorRef: (gi !== undefined ? sidecar.G[gi] : undefined) ?? '',
      schemaPointer: (si !== undefined ? sidecar.S[si] : undefined) ?? '',
      variant: (vi !== undefined ? sidecar.V[vi] : undefined) || 'main'
    }
  })

const mapsDir = (root: string, project: string): string =>
  join(root, '.skmtc', project, '.maps')

/** Every `*.skm.json` under `.maps`, recursively. `[]` when the tree is
 *  absent (the project has never generated with `--anchors`). */
const sidecarPaths = async (dir: string): Promise<string[]> => {
  let dirents
  try {
    dirents = await readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }
  const nested = await Promise.all(
    dirents.map((dirent) => {
      const path = join(dir, dirent.name)
      if (dirent.isDirectory()) return sidecarPaths(path)
      return Promise.resolve(dirent.name.endsWith('.skm.json') ? [path] : [])
    })
  )
  return nested.flat()
}

/**
 * Read + decode the project's gen-map. Only sidecars whose realigned path is
 * a manifest `files` key are included (the same membership guard the
 * artifacts read uses — `.maps` accumulates sidecars for renamed/removed
 * artifacts and older generates). Files whose on-disk length differs from the
 * manifest's `characters` land in `staleFiles` with their entries EXCLUDED —
 * a stale span is worse than no span.
 */
export const readGenMap = async (
  root: string,
  project: string,
  basePath: string
): Promise<GenMapResult> => {
  const manifestFiles = await readManifestFiles(root, project)
  const entries: GenMapEntry[] = []
  const staleFiles: string[] = []
  for (const path of await sidecarPaths(mapsDir(root, project))) {
    let sidecar: SidecarLike | null
    try {
      sidecar = toSidecar(JSON.parse(await readFile(path, 'utf8')))
    } catch {
      continue
    }
    if (sidecar === null) continue
    const artifactPath = resolveAliasPath(sidecar.f, basePath)
    const meta = manifestFiles[artifactPath]
    if (meta === undefined) continue
    const characters = isRecord(meta) && typeof meta.characters === 'number' ? meta.characters : null
    const onDiskLength = await readFile(join(root, artifactPath), 'utf8')
      .then((content) => content.length)
      .catch(() => null)
    if (onDiskLength === null || (characters !== null && characters !== onDiskLength)) {
      staleFiles.push(artifactPath)
      continue
    }
    entries.push(...sidecarToEntries(sidecar, artifactPath))
  }
  staleFiles.sort()
  return { entries, staleFiles }
}
