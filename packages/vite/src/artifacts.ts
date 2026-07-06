// Read the generated artifacts recorded by the last generate manifest — the
// `files` map of `path -> { lines, characters }`. The editor's code view lists
// them as a file tree and fetches one file's contents at a time. Membership in
// the manifest doubles as the path guard: only files the engine wrote are
// readable, so no traversal outside the working tree is possible.

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/** One generated file as listed by the manifest. */
export type ArtifactEntry = { path: string; lines?: number; characters?: number }

const manifestPath = (root: string, project: string): string =>
  join(root, '.skmtc', project, '.settings', 'manifest.json')

const readManifestFiles = async (
  root: string,
  project: string
): Promise<Record<string, unknown>> => {
  let parsed: unknown
  try {
    parsed = JSON.parse(await readFile(manifestPath(root, project), 'utf8'))
  } catch {
    return {}
  }
  return isRecord(parsed) && isRecord(parsed.files) ? parsed.files : {}
}

/** List the generated files from the manifest. Returns `[]` when the project
 *  hasn't been generated yet (no manifest) or the file is malformed. */
export async function readArtifacts(root: string, project: string): Promise<ArtifactEntry[]> {
  const files = await readManifestFiles(root, project)
  return Object.entries(files)
    .map(([path, meta]): ArtifactEntry => {
      const lines = isRecord(meta) && typeof meta.lines === 'number' ? meta.lines : undefined
      const characters =
        isRecord(meta) && typeof meta.characters === 'number' ? meta.characters : undefined
      return { path, lines, characters }
    })
    .sort((a, b) => a.path.localeCompare(b.path))
}

/** Read one generated file's contents. Returns null unless `path` is exactly a
 *  manifest `files` key (the guard — nothing outside the last generate's
 *  output is readable through this endpoint). */
export async function readArtifactContent(
  root: string,
  project: string,
  path: string
): Promise<string | null> {
  const files = await readManifestFiles(root, project)
  if (!Object.hasOwn(files, path)) return null
  try {
    return await readFile(join(root, path), 'utf8')
  } catch {
    return null
  }
}
