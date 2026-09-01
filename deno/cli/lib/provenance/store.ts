// Assembly point for one project's provenance: client.json + manifest +
// decoded gen-map + producer-class index, exposed as the query surface the
// editor providers (and, later, `skmtc trace`/`skmtc lsp`) call. Pure node —
// no vscode imports (see types.ts header).

import { readFile, stat } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import { anchorsForEntries, groupByFile, splitGeneratorRef } from '@/lib/provenance/anchors.ts'
import { readGenMap, readManifestFiles } from '@/lib/provenance/gen-map.ts'
import { buildIntervalIndex, type IntervalIndex } from '@/lib/provenance/interval-index.ts'
import { scanProducerIndex, type ProducerClassSite } from '@/lib/provenance/producer-index.ts'
import type { GenMapEntry, ResolvedAnchor } from '@/lib/provenance/types.ts'

export type ProducerSpan = {
  artifactPath: string
  from: number
  to: number
  schemaPointer: string
  variant: string
  generatorName: string
  landmark: string
}

/** Hand-mirrored slices of the manifest's diagnostic payloads (same stance
 *  as the sidecar shape in gen-map.ts — narrow defensively, never throw). */
export type ParseIssueLike = {
  level: 'error' | 'warning' | 'debug'
  message: string
  /** Stringified StackTrail (colon-joined, `:` escaped as `%3A`). */
  location: string
}

export type EnrichmentWarningLike = {
  message: string
  /** Config path into client.json's enrichments. */
  path: string[]
  suggestion: string | undefined
}

/** Everything the diagnostics layer needs from the last run, computable
 *  from the manifest alone — no engine changes (see friction theme 1:
 *  "success with no output" — an empty artifact map or zero-character
 *  files beside `success` results is the impossible state to surface). */
export type DiagnosticsInput = {
  parseIssues: ParseIssueLike[]
  enrichmentWarnings: EnrichmentWarningLike[]
  /** Manifest files recorded with `characters: 0`. */
  zeroCharacterFiles: string[]
  /** Count of `success` leaves in the manifest results tree. */
  successCount: number
  hasManifest: boolean
}

export type ProjectProvenance = {
  root: string
  project: string
  basePath: string
  /** Absolute path to the schema document, when client.json names a local file. */
  schemaPath: string | undefined
  /** Wall-clock end of the run that wrote the manifest, for the freshness line. */
  generatedAtIso: string | undefined
  /** manifest.json mtime at load — the manager's cheap reload trigger. */
  manifestMtimeMs: number
  /** Absolute path to this project's client.json — the carrier file for
   *  project-level diagnostics. */
  clientJsonPath: string
  diagnosticsInput: DiagnosticsInput
  staleFiles: Set<string>
  entryCount: number
  isArtifact(relPath: string): boolean
  /** Anchors for one artifact; `undefined` when the file has none captured. */
  fileAnchors(relPath: string): ResolvedAnchor[] | undefined
  /** Producer chain at an offset, innermost-first. `[]` = no span captured. */
  chainAt(relPath: string, offset: number): ResolvedAnchor[]
  /** Every span a producer class wrote, narrowest-first; optionally scoped
   *  to one generator package (bare class names collide across packages). */
  producerSpans(className: string, generatorName?: string): ProducerSpan[]
  producerSites(className: string): ProducerClassSite[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

type ClientSettings = { basePath: string; schemaSource: string | undefined }

const readClientSettings = async (
  root: string,
  project: string
): Promise<ClientSettings | undefined> => {
  let parsed: unknown
  try {
    parsed = JSON.parse(
      await readFile(join(root, '.skmtc', project, '.settings', 'client.json'), 'utf8')
    )
  } catch {
    return undefined
  }
  if (!isRecord(parsed)) return undefined
  const settings = isRecord(parsed.settings) ? parsed.settings : {}
  const basePath = typeof settings.basePath === 'string' ? settings.basePath : '.'
  const schemaSource = typeof parsed.source === 'string' ? parsed.source : undefined
  return { basePath, schemaSource }
}

/** Local schema sources only — URLs (remote schemas) have no jump target. */
const toSchemaPath = (root: string, source: string | undefined): string | undefined => {
  if (source === undefined || /^[a-z]+:\/\//.test(source)) return undefined
  return isAbsolute(source) ? source : join(root, source)
}

export const manifestFilePath = (root: string, project: string): string =>
  join(root, '.skmtc', project, '.settings', 'manifest.json')

const toParseIssue = (value: unknown): ParseIssueLike | undefined => {
  if (!isRecord(value) || typeof value.message !== 'string') return undefined
  const level = value.level === 'error' || value.level === 'debug' ? value.level : 'warning'
  return {
    level,
    message: value.message,
    location: typeof value.location === 'string' ? value.location : ''
  }
}

const toEnrichmentWarning = (value: unknown): EnrichmentWarningLike | undefined => {
  if (!isRecord(value) || typeof value.message !== 'string') return undefined
  return {
    message: value.message,
    path: Array.isArray(value.path) ? value.path.filter(p => typeof p === 'string') : [],
    suggestion: typeof value.suggestion === 'string' ? value.suggestion : undefined
  }
}

const countSuccessLeaves = (value: unknown): number => {
  if (value === 'success') return 1
  if (Array.isArray(value)) return value.reduce((sum: number, item) => sum + countSuccessLeaves(item), 0)
  if (isRecord(value)) {
    return Object.values(value).reduce((sum: number, item) => sum + countSuccessLeaves(item), 0)
  }
  return 0
}

const readManifestMeta = async (
  root: string,
  project: string
): Promise<{ endAt: number | undefined; mtimeMs: number; diagnosticsInput: DiagnosticsInput }> => {
  const path = manifestFilePath(root, project)
  const mtimeMs = await stat(path)
    .then(s => s.mtimeMs)
    .catch(() => 0)
  const diagnosticsInput: DiagnosticsInput = {
    parseIssues: [],
    enrichmentWarnings: [],
    zeroCharacterFiles: [],
    successCount: 0,
    hasManifest: false
  }
  let endAt: number | undefined
  try {
    const parsed: unknown = JSON.parse(await readFile(path, 'utf8'))
    if (isRecord(parsed)) {
      diagnosticsInput.hasManifest = true
      if (typeof parsed.endAt === 'number') endAt = parsed.endAt
      if (Array.isArray(parsed.parseIssues)) {
        diagnosticsInput.parseIssues = parsed.parseIssues.flatMap(issue => {
          const narrowed = toParseIssue(issue)
          return narrowed === undefined ? [] : [narrowed]
        })
      }
      if (Array.isArray(parsed.enrichmentWarnings)) {
        diagnosticsInput.enrichmentWarnings = parsed.enrichmentWarnings.flatMap(warning => {
          const narrowed = toEnrichmentWarning(warning)
          return narrowed === undefined ? [] : [narrowed]
        })
      }
      if (isRecord(parsed.files)) {
        diagnosticsInput.zeroCharacterFiles = Object.entries(parsed.files)
          .filter(([, meta]) => isRecord(meta) && meta.characters === 0)
          .map(([filePath]) => filePath)
          .sort()
      }
      diagnosticsInput.successCount = countSuccessLeaves(parsed.results)
    }
  } catch {
    // no manifest — defaults stand
  }
  return { endAt, mtimeMs, diagnosticsInput }
}

const toProducerSpan = (entry: GenMapEntry): ProducerSpan => ({
  artifactPath: entry.artifactPath,
  from: entry.artifactSpan[0] ?? 0,
  to: entry.artifactSpan[1] ?? 0,
  schemaPointer: entry.schemaPointer,
  variant: entry.variant,
  generatorName: splitGeneratorRef(entry.generatorRef).name,
  landmark: entry.projectionName
})

/**
 * Load one project's provenance. `undefined` when the project has no
 * client.json (not an SKMTC project). A project with no `.maps` loads with
 * zero entries — callers surface "no attribution captured", not an error.
 */
export const loadProjectProvenance = async (
  root: string,
  project: string
): Promise<ProjectProvenance | undefined> => {
  const client = await readClientSettings(root, project)
  if (client === undefined) return undefined
  const { endAt, mtimeMs, diagnosticsInput } = await readManifestMeta(root, project)
  const manifestFiles = await readManifestFiles(root, project)
  const { entries, staleFiles } = await readGenMap(root, project, client.basePath)

  const byFile = groupByFile(entries)
  const indexCache = new Map<string, IntervalIndex>()
  const anchorsCache = new Map<string, ResolvedAnchor[]>()

  const byProducer = new Map<string, ProducerSpan[]>()
  for (const entry of entries) {
    if (entry.producerName === '') continue
    const spans = byProducer.get(entry.producerName) ?? []
    spans.push(toProducerSpan(entry))
    byProducer.set(entry.producerName, spans)
  }
  for (const spans of byProducer.values()) {
    spans.sort((a, b) => a.to - a.from - (b.to - b.from))
  }

  const producerIndex = await scanProducerIndex(root, project)

  const fileAnchors = (relPath: string): ResolvedAnchor[] | undefined => {
    const grouped = byFile.get(relPath)
    if (grouped === undefined) return undefined
    const cached = anchorsCache.get(relPath)
    if (cached !== undefined) return cached
    const anchors = anchorsForEntries(grouped)
    anchorsCache.set(relPath, anchors)
    return anchors
  }

  return {
    root,
    project,
    basePath: client.basePath,
    schemaPath: toSchemaPath(root, client.schemaSource),
    generatedAtIso: endAt !== undefined ? new Date(endAt).toISOString() : undefined,
    manifestMtimeMs: mtimeMs,
    clientJsonPath: join(root, '.skmtc', project, '.settings', 'client.json'),
    diagnosticsInput,
    staleFiles: new Set(staleFiles),
    entryCount: entries.length,
    isArtifact: relPath => Object.hasOwn(manifestFiles, relPath),
    fileAnchors,
    chainAt: (relPath, offset) => {
      const anchors = fileAnchors(relPath)
      if (anchors === undefined) return []
      const index =
        indexCache.get(relPath) ??
        (() => {
          const built = buildIntervalIndex(anchors)
          indexCache.set(relPath, built)
          return built
        })()
      return index.allContaining(offset).reverse()
    },
    producerSpans: (className, generatorName) => {
      const spans = byProducer.get(className) ?? []
      return generatorName === undefined
        ? spans
        : spans.filter(span => span.generatorName === generatorName)
    },
    producerSites: className => producerIndex.get(className) ?? []
  }
}

/**
 * Representative output span for a producer: the narrowest span that carries
 * a schema pointer (the most tellable example), else just the narrowest.
 * Spans arrive narrowest-first from `producerSpans`.
 */
export const representativeSpan = (spans: ProducerSpan[]): ProducerSpan | undefined =>
  spans.find(span => span.schemaPointer !== '') ?? spans[0]
