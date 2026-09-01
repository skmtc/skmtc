// Class-level producer → source index over the project's CLONED generators
// (`.skmtc/<project>/<gen-pkg>/src/**`). Sidecars record only the producer's
// class name (`producerName = producer.constructor.name`), never a source
// location — so "go to the code that wrote this" resolves at the granularity
// authors think in: the Projection/Snippet CLASS declaration. Lang-package
// classes (TsString, TsDefinition, …) live in the JSR cache, not the
// workspace, and are deliberately out of scope for the prototype.
//
// Scanning is regex-level (line-anchored `class X` declarations) — a parse
// buys nothing here: class declarations in generator source are top-level
// statements, and a false positive merely offers a jump target.

import { readFile, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'

export type ProducerClassSite = {
  className: string
  /** Generator package name from the clone's deno.json (e.g. `@reapit/gen-zod`). */
  packageName: string
  /** Absolute path to the declaring file. */
  filePath: string
  /** 0-based line of the declaration. */
  line: number
  /** 0-based column of the class NAME on that line. */
  column: number
}

const CLASS_DECLARATION = /^\s*(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][A-Za-z0-9_$]*)/

const isDirectory = async (path: string): Promise<boolean> => {
  try {
    return (await stat(path)).isDirectory()
  } catch {
    return false
  }
}

const sourceFiles = async (dir: string): Promise<string[]> => {
  let dirents
  try {
    dirents = await readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }
  const nested = await Promise.all(
    dirents.map(dirent => {
      const path = join(dir, dirent.name)
      if (dirent.isDirectory()) return sourceFiles(path)
      return Promise.resolve(/\.tsx?$/.test(dirent.name) ? [path] : [])
    })
  )
  return nested.flat()
}

const packageNameOf = async (cloneDir: string, fallback: string): Promise<string> => {
  try {
    const parsed: unknown = JSON.parse(await readFile(join(cloneDir, 'deno.json'), 'utf8'))
    if (parsed !== null && typeof parsed === 'object' && 'name' in parsed) {
      const { name } = parsed as { name: unknown }
      if (typeof name === 'string' && name !== '') return name
    }
  } catch {
    // fall through
  }
  return fallback
}

const scanClone = async (
  cloneDir: string,
  packageName: string,
  index: Map<string, ProducerClassSite[]>
): Promise<void> => {
  for (const filePath of await sourceFiles(join(cloneDir, 'src'))) {
    const content = await readFile(filePath, 'utf8').catch(() => null)
    if (content === null) continue
    const lines = content.split('\n')
    for (const [line, text] of lines.entries()) {
      const matched = CLASS_DECLARATION.exec(text)
      if (matched === null) continue
      const className = matched[1] ?? ''
      if (className === '') continue
      const column = text.indexOf(className, matched[0].length - className.length)
      const sites = index.get(className) ?? []
      sites.push({ className, packageName, filePath, line, column: Math.max(column, 0) })
      index.set(className, sites)
    }
  }
}

/**
 * Index every `class X` declaration in the project's cloned generator
 * sources. A clone is any subdirectory of `.skmtc/<project>/` carrying both
 * a `deno.json` and a `src/` tree (excludes `.settings`/`.maps`/
 * `.baselines`, which have neither).
 */
export const scanProducerIndex = async (
  root: string,
  project: string
): Promise<Map<string, ProducerClassSite[]>> => {
  const projectDir = join(root, '.skmtc', project)
  const index = new Map<string, ProducerClassSite[]>()
  let dirents
  try {
    dirents = await readdir(projectDir, { withFileTypes: true })
  } catch {
    return index
  }
  for (const dirent of dirents) {
    if (!dirent.isDirectory()) continue
    const cloneDir = join(projectDir, dirent.name)
    const hasManifest = await readFile(join(cloneDir, 'deno.json'), 'utf8')
      .then(() => true)
      .catch(() => false)
    if (!hasManifest || !(await isDirectory(join(cloneDir, 'src')))) continue
    const packageName = await packageNameOf(cloneDir, dirent.name)
    await scanClone(cloneDir, packageName, index)
  }
  return index
}
