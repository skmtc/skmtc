/**
 * Headless `trace` — answer "which producers, generator, and schema element
 * wrote this position of this generated file", from the last generate's
 * provenance maps (`.maps` sidecars). The mechanism the skmtc-debug skill
 * previously described as a manual exercise ("map each TS error back to the
 * generator source that produced the offending line").
 *
 * Addressing is `<file>:<line>[:<col>]` with 1-based line/col — the shape a
 * compiler error hands an agent.
 */

import { readFile, readdir } from 'node:fs/promises'
import { isAbsolute, join, relative } from 'node:path'
import { existsSync } from '@std/fs/exists'
import { loadProjectProvenance, type ProjectProvenance } from '@/lib/provenance/store.ts'
import { toFreshness, type Freshness } from '@/lib/provenance/freshness.ts'

export type TraceHop = {
  producer: string
  generator: string
  schemaPointer: string
  variant: string
  landmark: string
  span: { from: number; to: number }
  /** `<root-relative file>:<1-based line>` of the producer class in a cloned
   *  generator, when the class-level index has it (lang-package classes live
   *  in the JSR cache and resolve to null). */
  producerSource: string | null
}

export type TraceSuccess = {
  type: 'traced'
  project: string
  file: string
  position: { line: number; column: number; offset: number }
  freshness: Freshness
  /** Innermost-first. Empty = the file is known but no span covers the position. */
  chain: TraceHop[]
  notes: string[]
}

export type TraceFailure = {
  type: 'trace-failed'
  message: string
  hint?: string
}

export type TraceResult = TraceSuccess | TraceFailure

export type RunTraceArgs = {
  /** Workspace root (the directory containing `.skmtc/`). */
  root: string
  /** Explicit project; omitted → search every project for the file. */
  project?: string
  /** `<file>:<line>[:<col>]`, file root-relative or absolute. */
  location: string
}

type ParsedLocation = { file: string; line: number; column: number }

/** `src/a.ts:12:5` → parts. Windows drive letters aren't a concern (the
 *  CLI's own path handling is posix throughout). */
export const parseLocation = (location: string): ParsedLocation | undefined => {
  const matched = /^(.+?):(\d+)(?::(\d+))?$/.exec(location)
  if (matched === null) return undefined
  const [, file = '', lineText = '', columnText] = matched
  const line = Number(lineText)
  const column = columnText === undefined ? 1 : Number(columnText)
  if (line < 1 || column < 1) return undefined
  return { file, line, column }
}

const toOffset = (text: string, line: number, column: number): number | undefined => {
  const lines = text.split('\n')
  if (line > lines.length) return undefined
  const priorLines = lines.slice(0, line - 1)
  const lineStart = priorLines.reduce((sum, current) => sum + current.length + 1, 0)
  const lineLength = lines[line - 1]?.length ?? 0
  return lineStart + Math.min(column - 1, lineLength)
}

export const listProjects = async (root: string): Promise<string[]> => {
  try {
    const dirents = await readdir(join(root, '.skmtc'), { withFileTypes: true })
    return dirents
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)
      .filter(name => existsSync(join(root, '.skmtc', name, '.settings', 'client.json')))
      .sort()
  } catch {
    return []
  }
}

const findOwningProject = async (
  root: string,
  relPath: string,
  explicit: string | undefined
): Promise<ProjectProvenance | undefined> => {
  const candidates = explicit === undefined ? await listProjects(root) : [explicit]
  for (const project of candidates) {
    const prov = await loadProjectProvenance(root, project)
    if (prov === undefined) continue
    if (prov.isArtifact(relPath) || prov.staleFiles.has(relPath)) return prov
    if (explicit !== undefined) return prov
  }
  return undefined
}

export const toProducerSource = (
  prov: ProjectProvenance,
  producerName: string,
  generatorName: string
): string | null => {
  const allSites = prov.producerSites(producerName)
  const scoped = allSites.filter(site => site.packageName === generatorName)
  const site = (scoped.length > 0 ? scoped : allSites)[0]
  if (site === undefined) return null
  return `${relative(prov.root, site.filePath)}:${site.line + 1}`
}

export const runTrace = async ({ root, project, location }: RunTraceArgs): Promise<TraceResult> => {
  const parsed = parseLocation(location)
  if (parsed === undefined) {
    return {
      type: 'trace-failed',
      message: `Location '${location}' is not <file>:<line>[:<col>] (1-based).`,
      hint: 'Example: skmtc trace src/types/apiErrorModel.generated.ts:12 --json'
    }
  }
  const relPath = (isAbsolute(parsed.file) ? relative(root, parsed.file) : parsed.file)
    .split('\\')
    .join('/')

  const prov = await findOwningProject(root, relPath, project)
  if (prov === undefined) {
    return {
      type: 'trace-failed',
      message: `No project's last generate wrote '${relPath}'.`,
      hint: 'List projects with skmtc agent-context --json; regenerate with --anchors if .maps is missing.'
    }
  }

  const notes: string[] = []
  if (!prov.isArtifact(relPath) && !prov.staleFiles.has(relPath)) {
    return {
      type: 'trace-failed',
      message: `'${relPath}' is not in project '${prov.project}''s manifest — not a generated artifact of the last run.`
    }
  }
  if (prov.staleFiles.has(relPath)) {
    notes.push(
      'Attribution for this file is stale (reshaped after generate and not re-anchorable) — regenerate with --anchors.'
    )
  }
  if (prov.entryCount === 0) {
    notes.push('No provenance maps decoded — regenerate with --anchors to capture attribution.')
  }

  const content = await readFile(join(root, relPath), 'utf8').catch(() => null)
  if (content === null) {
    return { type: 'trace-failed', message: `Cannot read '${relPath}'.` }
  }
  const offset = toOffset(content, parsed.line, parsed.column)
  if (offset === undefined) {
    return {
      type: 'trace-failed',
      message: `Line ${parsed.line} is past the end of '${relPath}'.`
    }
  }

  const chain = prov.chainAt(relPath, offset).map(anchor => ({
    producer: anchor.producerName || anchor.landmark,
    generator: anchor.generator.name,
    schemaPointer: anchor.schemaPointer,
    variant: anchor.variant,
    landmark: anchor.landmark,
    span: { from: anchor.fromByte, to: anchor.toByte },
    producerSource: toProducerSource(prov, anchor.producerName, anchor.generator.name)
  }))
  if (chain.length === 0 && prov.entryCount > 0 && !prov.staleFiles.has(relPath)) {
    notes.push('No span captured at this position (coverage is best-effort).')
  }

  return {
    type: 'traced',
    project: prov.project,
    file: relPath,
    position: { line: parsed.line, column: parsed.column, offset },
    freshness: toFreshness(prov),
    chain,
    notes
  }
}
