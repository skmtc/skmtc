// Read the generate manifest's `previews` — the map of generated artifacts the
// editor can render (module path + export name) crossed with the subject that
// produced each (so the editor knows which enrichment leaf drives it).

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/** One renderable preview: the generated module to mount + the subject behind it. */
export type Preview = {
  name: string
  module: { name: string; exportPath: string }
  source: Record<string, unknown>
}

const manifestPath = (root: string, project: string): string =>
  join(root, '.skmtc', project, '.settings', 'manifest.json')

// Normalize an artifact path to a key comparable across the manifest's two
// representations: `previews` use the `@/…` export-path alias, `files` use the
// `src/…` on-disk path. Strip the leading root so a preview can be matched to
// the file that actually backs it.
const artifactKey = (path: string): string => path.replace(/^(?:@\/|src\/|\.\/)/, '')

/** Read the manifest's previews as a flat list. Returns `[]` when the project
 *  hasn't been generated yet (no manifest) or the file is malformed.
 *
 *  A preview is only renderable if its module was actually emitted — the harness
 *  dynamically imports `exportPath` from the working tree, so a preview with no
 *  backing file in `files` 404s ("Failed to fetch dynamically imported module").
 *  The generate manifest can list previews for subjects whose file the generator
 *  declined to write (e.g. a `<Model>SelectField` registered for a non-enum ref),
 *  so cross-reference `files` and drop the phantoms. */
export async function readPreviews(root: string, project: string): Promise<Preview[]> {
  let parsed: unknown
  try {
    parsed = JSON.parse(await readFile(manifestPath(root, project), 'utf8'))
  } catch {
    return []
  }
  if (!isRecord(parsed) || !isRecord(parsed.previews)) return []

  const emitted = isRecord(parsed.files)
    ? new Set(Object.keys(parsed.files).map(artifactKey))
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
    previews.push({ name, module: { name: moduleName, exportPath }, source: entry.source })
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
