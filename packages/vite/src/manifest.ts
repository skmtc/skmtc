// Read the generate manifest's `previews` — the map of generated artifacts the
// editor can render (module path + export name) crossed with the subject that
// produced each (so the editor knows which enrichment leaf drives it).

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/** One renderable preview: the generated module to mount + the subject behind it.
 *  `url` is the browser-fetchable module URL the iframe harness imports (see
 *  `toModuleUrl`); `exportPath` is kept as the raw `@/…` alias for callers that
 *  match against the manifest (e.g. the input matcher). */
export type Preview = {
  name: string
  module: { name: string; exportPath: string; url: string }
  source: Record<string, unknown>
}

const manifestPath = (root: string, project: string): string =>
  join(root, '.skmtc', project, '.settings', 'manifest.json')

// Resolve a preview's `@/…` export path to a browser-fetchable module URL.
//
// The iframe harness dynamically imports this against the CONSUMER's Vite dev
// server, which serves modules relative to its OWN root. In a monorepo the Vite
// root (the nested app, e.g. `apps/x`) differs from the skmtc root (the repo
// root holding `.skmtc/`), so a `basePath`-rooted URL like `/apps/x/src/…` — the
// path relative to the skmtc root — isn't servable and hits the SPA fallback
// (`text/html`, rejected as a JS module). We instead resolve to the file's
// ABSOLUTE path and address it via Vite's `/@fs/` prefix, which Vite serves
// regardless of its root — sidestepping the root-relativity entirely. In a
// single-package repo (Vite root === skmtc root) this resolves to the same file
// the old `/${basePath}/…` URL did. `basePath` is the generated-output dir
// relative to the skmtc root; a non-`@/` path is returned unchanged (nothing to
// resolve). POSIX absolute paths only (the preview stack is a local dev tool).
export const toModuleUrl = (root: string, basePath: string, exportPath: string): string =>
  exportPath.startsWith('@/') ? `/@fs${join(root, basePath, exportPath.slice(2))}` : exportPath

// Normalize an artifact path to a key comparable across the manifest's two
// representations: `previews` use the `@/…` export-path alias, `files` entries
// carry a matching `@/…` `destinationPath`. Strip the leading root so a preview
// can be matched to the file that actually backs it.
const artifactKey = (path: string): string => path.replace(/^(?:@\/|src\/|\.\/)/, '')

// The `@/…`-aliased path a `files` entry writes to, which is what previews
// reference. Prefer `destinationPath` over the object key: the key is the raw
// on-disk path, so in a monorepo (`basePath: apps/x/src`) it carries an
// `apps/…` prefix `artifactKey` can't strip and never matches a preview's
// `@/…` exportPath. `destinationPath` is `@/…` in both single-package and
// monorepo layouts. Fall back to the key when an entry has no destinationPath.
const emittedKey = (key: string, entry: unknown): string =>
  artifactKey(
    isRecord(entry) && typeof entry.destinationPath === 'string' ? entry.destinationPath : key
  )

/** Read the manifest's previews as a flat list. Returns `[]` when the project
 *  hasn't been generated yet (no manifest) or the file is malformed.
 *
 *  A preview is only renderable if its module was actually emitted — the harness
 *  dynamically imports `exportPath` from the working tree, so a preview with no
 *  backing file in `files` 404s ("Failed to fetch dynamically imported module").
 *  The generate manifest can list previews for subjects whose file the generator
 *  declined to write (e.g. a `<Model>SelectField` registered for a non-enum ref),
 *  so cross-reference `files` and drop the phantoms. */
export async function readPreviews(
  root: string,
  project: string,
  basePath: string
): Promise<Preview[]> {
  let parsed: unknown
  try {
    parsed = JSON.parse(await readFile(manifestPath(root, project), 'utf8'))
  } catch {
    return []
  }
  if (!isRecord(parsed) || !isRecord(parsed.previews)) return []

  const emitted = isRecord(parsed.files)
    ? new Set(Object.entries(parsed.files).map(([key, entry]) => emittedKey(key, entry)))
    : undefined

  const previews: Preview[] = []
  for (const [name, entry] of Object.entries(parsed.previews)) {
    if (!isRecord(entry) || !isRecord(entry.module) || !isRecord(entry.source)) continue
    const moduleName = entry.module.name
    const exportPath = entry.module.exportPath
    if (typeof moduleName !== 'string' || typeof exportPath !== 'string') continue
    // Drop previews whose module was never written (no backing file → 404 on
    // import). When the manifest carries no `files` map, keep all (can't tell).
    if (emitted && !emitted.has(artifactKey(exportPath))) continue
    previews.push({
      name,
      module: { name: moduleName, exportPath, url: toModuleUrl(root, basePath, exportPath) },
      source: entry.source
    })
  }
  return previews
}

/**
 * Model type name → import path, read from the gen-map (`.maps/_map.ndjson`, emitted
 * by `skmtc generate --anchors`). Each row is `{ f, name, g, s, v }`; `f` is the
 * artifact's `@/…` path. Decouples model resolution from any naming convention.
 * Returns an empty map when anchors weren't emitted — the matcher then reports a
 * `model-missing` outcome (it never guesses an import path).
 */
export async function readModelImports(
  root: string,
  project: string
): Promise<Map<string, string>> {
  let text: string
  try {
    text = await readFile(join(root, '.skmtc', project, '.maps', '_map.ndjson'), 'utf8')
  } catch {
    return new Map()
  }
  const imports = new Map<string, string>()
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    let row: unknown
    try {
      row = JSON.parse(line)
    } catch {
      continue
    }
    if (
      isRecord(row) &&
      typeof row.name === 'string' &&
      typeof row.f === 'string' &&
      !imports.has(row.name)
    ) {
      imports.set(row.name, row.f.replace(/\.tsx?$/, ''))
    }
  }
  return imports
}
