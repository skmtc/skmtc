/**
 * Headless `explain` — two subjects, both answered from the last generate's
 * write-products:
 *
 *  - `producer <Class>`: what a Projection/Snippet class ACTUALLY emitted —
 *    span/file counts, the class's source in the cloned generator, and up to
 *    three representative output slices. The exemplar dispenser: real output
 *    beats API archaeology (eval finding F13 — agents converge on discipline
 *    by imitating real output, not by reading instructions).
 *
 *  - `ref <Name>`: what the last run SETTLED for a definition name — which
 *    generator claims it, in which artifact, from which schema element
 *    (from `.maps/_map.ndjson`). The v1 slice of Workstream B5's
 *    explain-ref; live hit-or-miss prediction stays engine work.
 */

import { readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { loadProjectProvenance, representativeSpan, type ProjectProvenance } from '@/lib/provenance/store.ts'
import { readGenerationMap } from '@/lib/provenance/generation-map.ts'
import { toFreshness, type Freshness } from '@/lib/provenance/freshness.ts'
import { listProjects } from '@/lib/trace-headless.ts'

const SAMPLE_COUNT = 3
const SAMPLE_CHAR_CAP = 700
const SAMPLE_LINE_CAP = 15

export type ProducerSample = {
  artifactPath: string
  schemaPointer: string
  variant: string
  span: { from: number; to: number }
  code: string
  truncated: boolean
}

export type ExplainProducerSuccess = {
  type: 'producer-explained'
  project: string
  className: string
  freshness: Freshness
  /** Class declaration sites in the cloned generators, `<file>:<line>`. */
  sources: string[]
  spanCount: number
  fileCount: number
  samples: ProducerSample[]
  notes: string[]
}

export type ExplainRefSuccess = {
  type: 'ref-explained'
  project: string
  name: string
  freshness: Freshness
  definitions: {
    artifactPath: string
    generator: string
    schemaPointer: string
    variant: string
  }[]
  notes: string[]
}

export type ExplainFailure = {
  type: 'explain-failed'
  message: string
  hint?: string
}

export type ExplainResult = ExplainProducerSuccess | ExplainRefSuccess | ExplainFailure

type ResolveProjectArgs = {
  root: string
  project: string | undefined
  matches: (prov: ProjectProvenance) => boolean
}

/** Explicit project wins; otherwise the first project with a match, else
 *  the first project at all (so freshness/notes still say something useful). */
const resolveProject = async ({
  root,
  project,
  matches
}: ResolveProjectArgs): Promise<ProjectProvenance | undefined> => {
  const names = project === undefined ? await listProjects(root) : [project]
  let fallback: ProjectProvenance | undefined
  for (const name of names) {
    const prov = await loadProjectProvenance(root, name)
    if (prov === undefined) continue
    if (matches(prov)) return prov
    fallback ??= prov
  }
  return fallback
}

const capSlice = (text: string): { code: string; truncated: boolean } => {
  const lines = text.split('\n')
  const capped = lines.slice(0, SAMPLE_LINE_CAP).join('\n')
  const short = capped.length > SAMPLE_CHAR_CAP ? capped.slice(0, SAMPLE_CHAR_CAP) : capped
  return { code: short, truncated: short.length < text.length }
}

export type ExplainProducerArgs = {
  root: string
  project?: string
  className: string
  generator?: string
}

export const explainProducer = async ({
  root,
  project,
  className,
  generator
}: ExplainProducerArgs): Promise<ExplainResult> => {
  const prov = await resolveProject({
    root,
    project,
    matches: candidate =>
      candidate.producerSpans(className, generator).length > 0 ||
      candidate.producerSites(className).length > 0
  })
  if (prov === undefined) {
    return {
      type: 'explain-failed',
      message: `No SKMTC project found under '${root}'.`,
      hint: 'Run from a workspace containing .skmtc/, or pass a project name.'
    }
  }

  const scoped = prov.producerSpans(className, generator)
  const spans = scoped.length > 0 ? scoped : prov.producerSpans(className)
  const sources = prov
    .producerSites(className)
    .map(site => `${relative(prov.root, site.filePath)}:${site.line + 1}`)

  const notes: string[] = []
  if (spans.length === 0) {
    notes.push(
      sources.length > 0
        ? 'Class is declared in a cloned generator but wrote no spans in the last generate (new or unexercised producer).'
        : `No spans and no class declaration found for '${className}' — check the spelling, or the class may live in a lang package (JSR cache) rather than a clone.`
    )
  }

  const samples: ProducerSample[] = []
  const seenArtifacts = new Set<string>()
  const ordered = [representativeSpan(spans), ...spans].flatMap(span =>
    span === undefined ? [] : [span]
  )
  for (const span of ordered) {
    if (samples.length >= SAMPLE_COUNT || seenArtifacts.has(span.artifactPath)) continue
    const content = await readFile(join(prov.root, span.artifactPath), 'utf8').catch(() => null)
    if (content === null) continue
    seenArtifacts.add(span.artifactPath)
    const { code, truncated } = capSlice(content.slice(span.from, span.to))
    samples.push({
      artifactPath: span.artifactPath,
      schemaPointer: span.schemaPointer,
      variant: span.variant,
      span: { from: span.from, to: span.to },
      code,
      truncated
    })
  }

  return {
    type: 'producer-explained',
    project: prov.project,
    className,
    freshness: toFreshness(prov),
    sources,
    spanCount: spans.length,
    fileCount: new Set(spans.map(span => span.artifactPath)).size,
    samples,
    notes
  }
}

export type ExplainRefArgs = {
  root: string
  project?: string
  name: string
}

export const explainRef = async ({ root, project, name }: ExplainRefArgs): Promise<ExplainResult> => {
  const prov = await resolveProject({ root, project, matches: () => true })
  if (prov === undefined) {
    return {
      type: 'explain-failed',
      message: `No SKMTC project found under '${root}'.`,
      hint: 'Run from a workspace containing .skmtc/, or pass a project name.'
    }
  }

  const candidates =
    project === undefined ? await listProjects(root) : [project]
  for (const candidate of candidates) {
    const candidateProv =
      candidate === prov.project ? prov : await loadProjectProvenance(root, candidate)
    if (candidateProv === undefined) continue
    const entries = (
      await readGenerationMap(root, candidateProv.project, candidateProv.basePath)
    ).filter(entry => entry.definitionName === name)
    if (entries.length === 0) continue
    return {
      type: 'ref-explained',
      project: candidateProv.project,
      name,
      freshness: toFreshness(candidateProv),
      definitions: entries.map(entry => ({
        artifactPath: entry.artifactPath,
        generator: entry.generatorId,
        schemaPointer: entry.schemaPointer,
        variant: entry.variant
      })),
      notes: []
    }
  }

  return {
    type: 'ref-explained',
    project: prov.project,
    name,
    freshness: toFreshness(prov),
    definitions: [],
    notes: [
      `No definition named '${name}' in the last generate's registry index (_map.ndjson).`,
      'Names are Definition identifiers as registered — check casing, or regenerate with --anchors.'
    ]
  }
}
