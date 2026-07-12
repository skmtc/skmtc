/**
 * @fileoverview Phase 0 spike for format-agnostic attribution
 * (skmtc-hub `notes/plan-2026-07-12-format-agnostic-attribution.md`).
 *
 * Question: do landmark + AST child-index paths survive a real
 * consumer project's formatter, so sidecar spans can be re-anchored
 * onto the formatted file instead of being dropped as stale?
 *
 * Method: for every anchor in every sidecar of a project generated
 * RAW (`skmtc generate --anchors`, before the project's formatter
 * ran), resolve the anchor's landmark + path against the RAW text
 * (what a host-side post-pass would emit), then descend the same
 * path in the FORMATTED text's AST and compare the two nodes' text
 * (normalized for the formatter's cosmetic rewrites). A match means
 * the anchor re-anchors correctly.
 *
 * Usage:
 *   deno run -A spike-reanchor.ts <mapsDir> <rawRoot> <formattedRoot> [limit]
 *
 * e.g. against skmtc-reapit with the raw snapshot in the scratchpad:
 *   deno run -A deno/core/anchors/spike-reanchor.ts \
 *     ~/workspace/skmtc-root/skmtc-reapit/.skmtc/skmtc-reapit/.maps \
 *     /tmp/.../scratchpad/raw-src \
 *     ~/workspace/skmtc-root/skmtc-reapit/src
 */

import { walk } from '@std/fs/walk'
import { join } from '@std/path'
import { oxcAdapter } from './oxcAdapter.ts'
import type { NodeHandle } from './ParserAdapter.ts'

type OxcNodeLike = {
  type: string
  start: number
  end: number
  [key: string]: unknown
}

const isAstNode = (value: unknown): value is OxcNodeLike =>
  value !== null &&
  typeof value === 'object' &&
  'type' in value &&
  typeof (value as { type: unknown }).type === 'string' &&
  'start' in value &&
  typeof (value as { start: unknown }).start === 'number'

/** Whitespace-only JSXText nodes are formatting artifacts: a JSX reflow
 *  (one line ↔ many) adds/removes them, shifting sibling indices. Path
 *  stability requires indexing over SEMANTIC children only — the key
 *  spike finding for the Phase 1 adapter change. */
const isFormattingArtifact = (node: OxcNodeLike): boolean =>
  node.type === 'JSXText' && typeof node.value === 'string' && node.value.trim() === ''

/** Mirror of oxcAdapter's childrenOf (same key-order traversal rules),
 *  minus whitespace-only JSXText — see {@link isFormattingArtifact}. */
const childrenOf = (node: OxcNodeLike): OxcNodeLike[] => {
  const out: OxcNodeLike[] = []
  for (const key of Object.keys(node)) {
    if (key === 'type' || key === 'start' || key === 'end' || key === '_parent') continue
    const value = node[key]
    if (isAstNode(value)) out.push(value)
    else if (Array.isArray(value)) {
      for (const item of value) if (isAstNode(item)) out.push(item)
    }
  }
  return out.filter(child => !isFormattingArtifact(child))
}

/** Spike-local ascend: adapter's ascendToLandmark counts whitespace
 *  JSXText children, so paths it records don't survive JSX reflow.
 *  Recompute the path with the filtered childrenOf — both sides of the
 *  round-trip must use the same semantics. Reads the adapter's
 *  non-enumerable `_parent` stamp. */
const ascendFiltered = (
  node: OxcNodeLike,
  landmarks: Map<string, NodeHandle>
): { landmark: string; path: number[] } => {
  const reverseLookup = new Map<OxcNodeLike, string>()
  for (const [name, handle] of landmarks) {
    reverseLookup.set(handle as OxcNodeLike, name)
  }
  let current = node
  const path: number[] = []
  while (!reverseLookup.has(current)) {
    const parent = current._parent as OxcNodeLike | undefined
    if (parent === undefined) return { landmark: '', path: [] }
    const index = childrenOf(parent).indexOf(current)
    if (index === -1) return { landmark: '', path: [] }
    path.unshift(index)
    current = parent
  }
  return { landmark: reverseLookup.get(current) ?? '', path }
}

/** Descend a recorded child-index path from a landmark node. */
const descend = (landmark: OxcNodeLike, path: number[]): OxcNodeLike | undefined => {
  let current = landmark
  for (const index of path) {
    const child = childrenOf(current)[index]
    if (child === undefined) return undefined
    current = child
  }
  return current
}

/** Whitespace-only normalization — catches indentation/line-break moves. */
const normalizeWs = (text: string): string => text.replace(/\s+/g, '')

/** Loose normalization — additionally unifies the cosmetic rewrites a
 *  formatter makes (quote style, added semicolons, trailing commas,
 *  arrow-param parens). Node-type equality is checked separately, so
 *  the punctuation stripping can't paper over a wrong node. */
const normalizeLoose = (text: string): string =>
  normalizeWs(text)
    .replaceAll('"', "'")
    .replaceAll(';', '')
    .replaceAll(',', '')
    .replaceAll('(', '')
    .replaceAll(')', '')
    .replaceAll('|', '')

/** The adapter's collectLandmarks indexes exports only, but generated
 *  files also carry non-exported top-level declarations (`const
 *  columnHelper = …`) that spans live under. Index every named
 *  top-level declaration — the second spike finding for Phase 1. */
const collectAllTopLevel = (parsed: unknown): Map<string, NodeHandle> => {
  const landmarks = oxcAdapter.collectLandmarks(parsed)
  const program = (parsed as { program: OxcNodeLike }).program
  const body = (program.body as OxcNodeLike[] | undefined) ?? []
  const nameOf = (id: unknown): string | undefined =>
    isAstNode(id) && id.type === 'Identifier' && typeof id.name === 'string'
      ? (id.name as string)
      : undefined
  for (const statement of body) {
    if (statement.type === 'VariableDeclaration') {
      const declarations = (statement.declarations as OxcNodeLike[] | undefined) ?? []
      for (const declarator of declarations) {
        const name = nameOf(declarator.id)
        if (name && !landmarks.has(name)) landmarks.set(name, statement)
      }
    }
    if (
      statement.type === 'FunctionDeclaration' ||
      statement.type === 'ClassDeclaration' ||
      statement.type === 'TSTypeAliasDeclaration' ||
      statement.type === 'TSInterfaceDeclaration' ||
      statement.type === 'TSEnumDeclaration'
    ) {
      const name = nameOf(statement.id)
      if (name && !landmarks.has(name)) landmarks.set(name, statement)
    }
  }
  return landmarks
}

type SidecarFile = {
  f: string
  A: number[][]
  L: string[]
}

const readSidecar = (raw: string): SidecarFile | undefined => {
  const value: unknown = JSON.parse(raw)
  if (value === null || typeof value !== 'object') return undefined
  const record = value as Record<string, unknown>
  if (typeof record.f !== 'string' || !Array.isArray(record.A) || !Array.isArray(record.L)) {
    return undefined
  }
  const rows = record.A.filter(
    (row): row is number[] =>
      Array.isArray(row) && row.length >= 7 && row.every(entry => typeof entry === 'number')
  )
  const landmarks = record.L.filter((entry): entry is string => typeof entry === 'string')
  return { f: record.f, A: rows, L: landmarks }
}

type Tally = {
  files: number
  filesParseFailed: number
  filesUnitSkew: number
  anchors: number
  noLandmark: number
  landmarkMissing: number
  pathBroken: number
  matchedWs: number
  matchedLoose: number
  mismatched: number
  spanEqualsNode: number
}

const tally: Tally = {
  files: 0,
  filesParseFailed: 0,
  filesUnitSkew: 0,
  anchors: 0,
  noLandmark: 0,
  landmarkMissing: 0,
  pathBroken: 0,
  matchedWs: 0,
  matchedLoose: 0,
  mismatched: 0,
  spanEqualsNode: 0
}

type MismatchSample = {
  file: string
  landmark: string
  raw: string
  formatted: string
}
const mismatchSamples: MismatchSample[] = []
const brokenSamples: string[] = []
const noLandmarkSamples: string[] = []

const [mapsDir, rawRoot, formattedRoot, limitArg] = Deno.args
if (!mapsDir || !rawRoot || !formattedRoot) {
  console.error('usage: spike-reanchor.ts <mapsDir> <rawRoot> <formattedRoot> [limit]')
  Deno.exit(2)
}
const limit = limitArg ? Number(limitArg) : Infinity

const sidecarPaths: string[] = []
for await (const entry of walk(mapsDir, { includeDirs: false, exts: ['.json'] })) {
  if (entry.path.endsWith('.skm.json')) sidecarPaths.push(entry.path)
}
sidecarPaths.sort()

for (const sidecarPath of sidecarPaths.slice(0, limit)) {
  const sidecar = readSidecar(await Deno.readTextFile(sidecarPath))
  if (sidecar === undefined) continue
  // `f` is '@/'-aliased ('@/tables/X.generated.tsx'); both roots hold the
  // path minus the alias.
  const artifactRelative = sidecar.f.startsWith('@/') ? sidecar.f.slice(2) : sidecar.f
  let rawText: string
  let formattedText: string
  try {
    rawText = await Deno.readTextFile(join(rawRoot, artifactRelative))
    formattedText = await Deno.readTextFile(join(formattedRoot, artifactRelative))
  } catch {
    continue
  }
  tally.files += 1

  let rawParsed: unknown
  let formattedParsed: unknown
  try {
    rawParsed = oxcAdapter.parse(artifactRelative, rawText)
    formattedParsed = oxcAdapter.parse(artifactRelative, formattedText)
  } catch {
    tally.filesParseFailed += 1
    continue
  }
  // Unit check: sink spans are UTF-16 code units; if oxc's offsets were
  // bytes, a file with non-ASCII content would end past `rawText.length`.
  const rawProgram = (rawParsed as { program: OxcNodeLike }).program
  if (rawProgram.end > rawText.length) tally.filesUnitSkew += 1

  const rawLandmarks = collectAllTopLevel(rawParsed)
  const formattedLandmarks = collectAllTopLevel(formattedParsed)

  for (const row of sidecar.A) {
    const [, , , , , rawFrom, rawTo] = row
    tally.anchors += 1

    // Spans include the inter-statement whitespace the renderer emitted
    // (a trailing newline pushes `to` past the statement node's end, so
    // nothing but Program encloses them). Trim to non-whitespace extent.
    let from = rawFrom
    let to = rawTo
    while (from < to && /\s/.test(rawText[from])) from += 1
    while (to > from && /\s/.test(rawText[to - 1])) to -= 1

    const rawNodeHandle: NodeHandle = oxcAdapter.smallestEnclosing(rawParsed, from, to)
    const location = ascendFiltered(rawNodeHandle as OxcNodeLike, rawLandmarks)
    if (location.landmark === '') {
      tally.noLandmark += 1
      if (noLandmarkSamples.length < 8) {
        noLandmarkSamples.push(
          `${artifactRelative} [${from},${to}) ${(rawNodeHandle as OxcNodeLike).type}: ` +
            rawText.slice(from, from + 60).replaceAll('\n', '\\n')
        )
      }
      continue
    }
    const rawNode = rawNodeHandle as OxcNodeLike
    if (rawNode.start === from && rawNode.end === to) tally.spanEqualsNode += 1

    const formattedLandmark = formattedLandmarks.get(location.landmark) as OxcNodeLike | undefined
    if (formattedLandmark === undefined) {
      tally.landmarkMissing += 1
      brokenSamples.push(`${artifactRelative}: landmark ${location.landmark} missing`)
      continue
    }
    const formattedNode = descend(formattedLandmark, location.path)
    if (formattedNode === undefined) {
      tally.pathBroken += 1
      brokenSamples.push(
        `${artifactRelative}: path [${location.path}] broken under ${location.landmark}`
      )
      continue
    }

    const rawSlice = rawText.slice(rawNode.start, rawNode.end)
    const formattedSlice = formattedText.slice(formattedNode.start, formattedNode.end)
    if (rawNode.type !== formattedNode.type) {
      tally.mismatched += 1
      if (mismatchSamples.length < 10) {
        mismatchSamples.push({
          file: artifactRelative,
          landmark: `${location.landmark} (type ${rawNode.type} vs ${formattedNode.type})`,
          raw: rawSlice.slice(0, 120),
          formatted: formattedSlice.slice(0, 120)
        })
      }
      continue
    }
    if (normalizeWs(rawSlice) === normalizeWs(formattedSlice)) {
      tally.matchedWs += 1
    } else if (normalizeLoose(rawSlice) === normalizeLoose(formattedSlice)) {
      tally.matchedLoose += 1
    } else {
      tally.mismatched += 1
      if (mismatchSamples.length < 10) {
        mismatchSamples.push({
          file: artifactRelative,
          landmark: location.landmark,
          raw: rawSlice.slice(0, 120),
          formatted: formattedSlice.slice(0, 120)
        })
      }
    }
  }
}

const resolved = tally.matchedWs + tally.matchedLoose + tally.mismatched
const correct = tally.matchedWs + tally.matchedLoose
const rate = (count: number, total: number): string =>
  total === 0 ? 'n/a' : `${((count / total) * 100).toFixed(2)}%`

console.log(
  JSON.stringify(
    {
      ...tally,
      resolvedAnchors: resolved,
      correctOfResolved: rate(correct, resolved),
      correctOfAllAnchors: rate(correct, tally.anchors),
      noLandmarkRate: rate(tally.noLandmark, tally.anchors)
    },
    null,
    2
  )
)
if (noLandmarkSamples.length > 0) {
  console.log('\nno-landmark samples:')
  for (const sample of noLandmarkSamples) console.log('  ' + sample)
}
if (brokenSamples.length > 0) {
  console.log('\nbroken samples:')
  for (const sample of brokenSamples.slice(0, 10)) console.log('  ' + sample)
}
if (mismatchSamples.length > 0) {
  console.log('\nmismatch samples:')
  for (const sample of mismatchSamples) {
    console.log(`  ${sample.file} @ ${sample.landmark}`)
    console.log(`    raw:       ${sample.raw.replaceAll('\n', '\\n')}`)
    console.log(`    formatted: ${sample.formatted.replaceAll('\n', '\\n')}`)
  }
}
