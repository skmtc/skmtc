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
import { match } from 'ts-pattern'
import { readManifestFiles } from './artifacts.ts'
import { parseForReanchor, REANCHOR_PARSER_ID } from './reanchor.ts'
// The GenMapEntry/GenMapResult wire shapes are defined ONCE as valibot
// schemas in wire.ts (shared with the desktop via `@skmtc/vite/wire`); this
// module produces values of those types and re-exports them for in-package
// consumers.
import type { GenMapEntry, GenMapResult } from './wire.ts'
export type { GenMapEntry, GenMapResult } from './wire.ts'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(entry => (typeof entry === 'string' ? entry : '')) : []

/** The `G` pool holds `{ name, version, r }` records; only `name` is used —
 *  locally it is the generator's real package name. */
const asGeneratorNames = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.map(entry => (isRecord(entry) && typeof entry.name === 'string' ? entry.name : ''))
    : []

const asNumberArray = (value: unknown): number[] =>
  Array.isArray(value) ? value.map(entry => (typeof entry === 'number' ? entry : -1)) : []

/** One well-formed anchor row `[Li, Pi, gi, si, vi, from, to]`, paired with
 *  its producer-name pool index. The sidecar's `An` array is parallel to the
 *  RAW `A`, so the pairing must happen BEFORE malformed rows are dropped —
 *  filtering first would shift every later row's producer attribution. */
type AnchorRow = { row: number[]; producerIndex: number | undefined }

const isWellFormedRow = (row: unknown): row is number[] =>
  Array.isArray(row) && row.length >= 7 && row.every(n => typeof n === 'number')

type SidecarLike = {
  /** `@/`-aliased artifact path the sidecar describes. */
  f: string
  /** Parser id that resolved the landmarks + paths (`oxc@<version>`,
   *  or `'none'` from a worker-degraded sidecar). Paths are only safe
   *  to descend when it matches this package's pinned parser. */
  parser: string
  G: string[]
  S: string[]
  V: string[]
  L: string[]
  /** AST child-index paths (dot-joined), parallel-pooled with `L` — filled
   *  by the CLI's host-side post-pass; `''` on worker-degraded sidecars. */
  P: string[]
  anchors: AnchorRow[]
  N: string[]
}

const toSidecar = (value: unknown): SidecarLike | null => {
  if (!isRecord(value) || typeof value.f !== 'string') return null
  const producerIndices = asNumberArray(value.An)
  // Truncated or non-numeric rows are dropped entirely — they must not
  // materialize as zero-width entries at position 0.
  const anchors = Array.isArray(value.A)
    ? value.A.flatMap((row, index): AnchorRow[] =>
        isWellFormedRow(row) ? [{ row, producerIndex: producerIndices[index] }] : []
      )
    : []
  return {
    f: value.f,
    parser: typeof value.parser === 'string' ? value.parser : '',
    G: asGeneratorNames(value.G),
    S: asStringArray(value.S),
    V: asStringArray(value.V),
    L: asStringArray(value.L),
    P: asStringArray(value.P),
    anchors,
    N: asStringArray(value.N)
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

const rowToEntry = (
  sidecar: SidecarLike,
  artifactPath: string,
  { row, producerIndex }: AnchorRow,
  span: [number, number]
): GenMapEntry => {
  const [li, , gi, si, vi] = row
  return {
    artifactPath,
    artifactSpan: span,
    projectionName: (li !== undefined ? sidecar.L[li] : undefined) ?? '',
    producerName: (producerIndex !== undefined ? sidecar.N[producerIndex] : undefined) ?? '',
    generatorRef: (gi !== undefined ? sidecar.G[gi] : undefined) ?? '',
    schemaPointer: (si !== undefined ? sidecar.S[si] : undefined) ?? '',
    variant: (vi !== undefined ? sidecar.V[vi] : undefined) || 'main'
  }
}

const sidecarToEntries = (sidecar: SidecarLike, artifactPath: string): GenMapEntry[] =>
  sidecar.anchors.map(anchor =>
    rowToEntry(sidecar, artifactPath, anchor, [anchor.row[5] ?? 0, anchor.row[6] ?? 0])
  )

/**
 * Length drift means a formatter (or hand edit) reshaped the file after
 * generate — raw byte spans are unusable, but each anchor's landmark +
 * AST path still resolves against the CURRENT text. Entries whose anchor
 * can't be resolved (landmark renamed away, structure changed) are
 * dropped individually; `undefined` means the whole file can't be
 * re-anchored (unparseable / non-ASCII) and should be reported stale.
 *
 * Worker-degraded sidecars (empty `P` paths, `parser: 'none'`) get the
 * landmark-only fallback for free: an empty path resolves to the landmark
 * statement itself, so whole-Definition spans still highlight — inner
 * snippet spans collapse into their Definition until the next generate
 * runs the host-side post-pass.
 */
const reanchoredEntries = async (
  sidecar: SidecarLike,
  artifactPath: string,
  content: string
): Promise<GenMapEntry[] | undefined> => {
  const parsed = await parseForReanchor(artifactPath, content)
  if (parsed === undefined) return undefined
  // Paths recorded by a different parser version may index a
  // differently-keyed AST and descend to the WRONG node — worse than
  // stale. Trust them only on an exact parser-id match; otherwise fall
  // back to landmark-only resolution (empty path = the landmark
  // statement itself), the same coarse-but-correct behavior
  // worker-degraded sidecars get.
  const pathsTrusted = sidecar.parser === REANCHOR_PARSER_ID
  return sidecar.anchors.flatMap(anchor => {
    const [li, pi] = anchor.row
    const landmark = (li !== undefined ? sidecar.L[li] : undefined) ?? ''
    if (landmark === '') return []
    const pathText = pathsTrusted ? ((pi !== undefined ? sidecar.P[pi] : undefined) ?? '') : ''
    const path = pathText === '' ? [] : pathText.split('.').map(Number)
    return match(parsed.reanchor(landmark, path))
      .returnType<GenMapEntry[]>()
      .with({ type: 'resolved' }, ({ span }) => [rowToEntry(sidecar, artifactPath, anchor, span)])
      .with({ type: 'landmark-missing' }, { type: 'path-broken' }, () => [])
      .exhaustive()
  })
}

const mapsDir = (root: string, project: string): string => join(root, '.skmtc', project, '.maps')

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
    dirents.map(dirent => {
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
 * manifest's `characters` (a formatter ran after generate) are RE-ANCHORED:
 * each anchor's landmark + AST path is resolved against the current on-disk
 * text and the entry served with fresh spans. `staleFiles` now holds only
 * files that can't be re-anchored at all — unreadable, unparseable,
 * non-ASCII (span-unit skew), or with no resolvable anchors left (see
 * {@link GenMapResult}; length equality remains the drift trigger).
 *
 * One sidecar wins per artifact: `.maps` accumulation means two files can
 * declare the same `f` (e.g. a lingering copy at a stale mirror path). The
 * sidecar at the canonical mirror path (`.maps/<f>.skm.json`) is preferred;
 * ties fall to the lexicographically first path — deterministic either way.
 */
export const readGenMap = async (
  root: string,
  project: string,
  basePath: string
): Promise<GenMapResult> => {
  const manifestFiles = await readManifestFiles(root, project)
  const dir = mapsDir(root, project)

  const decoded: { path: string; sidecar: SidecarLike }[] = []
  for (const path of await sidecarPaths(dir)) {
    try {
      const sidecar = toSidecar(JSON.parse(await readFile(path, 'utf8')))
      if (sidecar !== null) decoded.push({ path, sidecar })
    } catch {
      // malformed JSON — skip
    }
  }
  const isMirror = (candidate: { path: string; sidecar: SidecarLike }): boolean =>
    candidate.path === join(dir, `${candidate.sidecar.f}.skm.json`)
  decoded.sort((a, b) => Number(isMirror(b)) - Number(isMirror(a)) || a.path.localeCompare(b.path))

  const seenArtifacts = new Set<string>()
  const entries: GenMapEntry[] = []
  const staleFiles: string[] = []
  for (const { sidecar } of decoded) {
    const artifactPath = resolveAliasPath(sidecar.f, basePath)
    if (seenArtifacts.has(artifactPath)) continue
    seenArtifacts.add(artifactPath)
    const meta = manifestFiles[artifactPath]
    if (meta === undefined) continue
    const characters =
      isRecord(meta) && typeof meta.characters === 'number' ? meta.characters : null
    const content = await readFile(join(root, artifactPath), 'utf8').catch(() => null)
    if (content === null) {
      staleFiles.push(artifactPath)
      continue
    }
    if (characters !== null && characters !== content.length) {
      const reanchored = await reanchoredEntries(sidecar, artifactPath, content)
      if (reanchored === undefined || reanchored.length === 0) {
        staleFiles.push(artifactPath)
        continue
      }
      entries.push(...reanchored)
      continue
    }
    entries.push(...sidecarToEntries(sidecar, artifactPath))
  }
  staleFiles.sort()
  return { entries, staleFiles }
}
