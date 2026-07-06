// The matcher substrate: the project's TypeScript source (the input/field
// component types the matcher type-checks against) and the OpenAPI document
// (for schemaPath resolution + OAS→TS field-type synthesis). Both are read
// straight off the working tree — no container dump, no synthesized stubs.

import { readFile, readdir } from 'node:fs/promises'
import { join, relative } from 'node:path'

export type SourceFile = { path: string; content: string }

const SOURCE_EXTENSIONS = ['.ts', '.tsx']
const isSourceFile = (name: string): boolean =>
  SOURCE_EXTENSIONS.some((extension) => name.endsWith(extension))

// Recursively collect .ts/.tsx files under a dir; paths are relative to `root`
// so the browser matcher can resolve `@/…` imports against the same anchor.
const walk = async (root: string, dir: string, collected: SourceFile[]): Promise<void> => {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return // a missing inputDir is not fatal — skip it
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      await walk(root, full, collected)
    } else if (isSourceFile(entry.name)) {
      collected.push({ path: relative(root, full), content: await readFile(full, 'utf8') })
    }
  }
}

/** Collect the .ts/.tsx files under each dir (paths relative to `root`). */
export async function readSource(root: string, dirs: string[]): Promise<SourceFile[]> {
  const collected: SourceFile[] = []
  for (const dir of dirs) {
    await walk(root, join(root, dir), collected)
  }
  return collected
}

/**
 * One selectable component export. `exportPath` is the `@/…` alias form — the
 * path stored in enrichments and imported by generated code. `filePath` is the
 * root-relative on-disk path the walker found it at — the matcher's probe
 * imports by THIS (relative, alias-free), so a consumer's `@`-alias config can
 * never break candidate resolution. Only `{ exportName, exportPath }` goes
 * over the wire to the editor.
 */
export type Candidate = { exportName: string; exportPath: string; filePath: string }

const EXPORT_RE = /^export\s+(?:const|function)\s+([A-Za-z_$][\w$]*)/gm

// `src/inputs/X.tsx` (relative to root) → `@/inputs/X.tsx` (the alias the
// generated code imports by). basePath is the `@` anchor.
const toExportPath = (relativePath: string, basePath: string): string => {
  const prefix = basePath.endsWith('/') ? basePath : `${basePath}/`
  return relativePath.startsWith(prefix) ? `@/${relativePath.slice(prefix.length)}` : relativePath
}

/**
 * The module-picker candidates: every value export (`export const` /
 * `export function`) from the inputDir files. This is the unfiltered set —
 * the type-aware matcher adjudicates each candidate against the field type.
 */
export async function readCandidates(
  root: string,
  dirs: string[],
  basePath: string
): Promise<Candidate[]> {
  const files = await readSource(root, dirs)
  return files.flatMap((file) => {
    const filePath = file.path.split('\\').join('/')
    const exportPath = toExportPath(filePath, basePath)
    return [...file.content.matchAll(EXPORT_RE)].map((match) => ({
      exportName: match[1],
      exportPath,
      filePath
    }))
  })
}

/** Read (path) or fetch (URL) the schema document at `client.json#source`. */
export async function readSchema(root: string, source: string): Promise<unknown> {
  if (/^https?:\/\//.test(source)) {
    const response = await fetch(source)
    if (!response.ok)
      throw new Error(`schema fetch failed: ${response.status} ${response.statusText}`)
    return response.json()
  }
  return JSON.parse(await readFile(join(root, source), 'utf8'))
}
