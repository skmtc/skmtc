// Resolve an RFC 6901 JSON pointer to a character range in the schema
// DOCUMENT TEXT — so "go to schema" can land on the actual line, not just
// open the file. Built on `jsonc-parser`'s position-annotated parse tree
// (VSCode's own JSON AST library); resolution is a plain tree walk, and any
// pointer that names a node the document doesn't have returns `undefined`
// (the honest behavior for the known synthetic-pointer cases — `allOf`-merged
// trails, operational-prefix leaks — never a guessed location).
//
// JSON only for the prototype (SKMTC schema sources on this machine are
// .json); a YAML resolver can slot in behind the same signature.

import { parseTree, type Node } from 'jsonc-parser'

export type PointerRange = {
  /** Range of the value the pointer addresses. */
  start: number
  end: number
  /** Range of the object key naming it (absent for array elements / root). */
  keyStart?: number
  keyEnd?: number
}

/** `#/a/b` or `/a/b` → `['a', 'b']`; `undefined` for anything else
 *  (empty pointers, GraphQL-style `Query.field` coordinates). */
export const pointerSegments = (pointer: string): string[] | undefined => {
  const bare = pointer.startsWith('#') ? pointer.slice(1) : pointer
  if (!bare.startsWith('/')) return undefined
  return bare
    .slice(1)
    .split('/')
    .map(segment => segment.replace(/~1/g, '/').replace(/~0/g, '~'))
}

/** Parsing a multi-MB schema is the expensive step and one hover resolves a
 *  whole producer chain of pointers — memoize the last (text, tree) pair.
 *  The manager caches one schema text string per store, so reference
 *  equality holds across a hover. */
let lastText: string | undefined
let lastTree: Node | undefined
const parsedTree = (text: string): Node | undefined => {
  if (text !== lastText) {
    lastText = text
    lastTree = parseTree(text)
  }
  return lastTree
}

type Step = { value: Node; key?: Node }

const descend = (node: Node, segment: string): Step | undefined => {
  if (node.type === 'object') {
    for (const property of node.children ?? []) {
      const [key, value] = property.children ?? []
      if (key?.value === segment && value !== undefined) return { value, key }
    }
    return undefined
  }
  if (node.type === 'array') {
    const index = Number(segment)
    if (!Number.isInteger(index) || index < 0 || segment !== String(index)) return undefined
    const value = node.children?.[index]
    return value === undefined ? undefined : { value }
  }
  // Scalar with segments left over — the pointer names a node that doesn't
  // exist (e.g. an allOf-merged synthetic path).
  return undefined
}

/** Resolve a pre-split segment path (e.g. an enrichment warning's config
 *  path) against `jsonText`. */
export const resolveSegmentsRange = (
  jsonText: string,
  segments: string[]
): PointerRange | undefined => {
  if (segments.length === 0) return undefined
  const root = parsedTree(jsonText)
  if (root === undefined) return undefined

  let step: Step = { value: root }
  for (const segment of segments) {
    const next = descend(step.value, segment)
    if (next === undefined) return undefined
    step = next
  }
  const { value, key } = step
  return {
    start: value.offset,
    end: value.offset + value.length,
    ...(key === undefined ? {} : { keyStart: key.offset, keyEnd: key.offset + key.length })
  }
}

/**
 * Resolve `pointer` against `jsonText`. `undefined` when the pointer is
 * empty, non-JSON-pointer-shaped, or names a node the document doesn't
 * have — callers label those synthetic rather than jumping.
 */
export const resolvePointerRange = (
  jsonText: string,
  pointer: string
): PointerRange | undefined => {
  const segments = pointerSegments(pointer)
  if (segments === undefined || (segments.length === 1 && segments[0] === '')) return undefined
  return resolveSegmentsRange(jsonText, segments)
}

/** Sidecar pointers address the document the ENGINE parsed — after any
 *  in-memory conversion (Swagger 2.0 → OAS3 up-convert, 3.1 → 3.0
 *  down-convert). Against a 2.0 source file, `#/components/schemas/X` lives
 *  at `#/definitions/X`. Try the recorded pointer first, then the known
 *  2.0 locations — found live against skmtc-reapit, whose source is 2.0.
 *  (Substrate debt: the engine could record source-relative pointers.) */
const POINTER_FALLBACKS: [RegExp, string][] = [
  [/^#\/components\/schemas\//, '#/definitions/'],
  [/^#\/components\/parameters\//, '#/parameters/'],
  [/^#\/components\/responses\//, '#/responses/']
]

export const pointerCandidates = (pointer: string): string[] => [
  pointer,
  ...POINTER_FALLBACKS.filter(([pattern]) => pattern.test(pointer)).map(
    ([pattern, replacement]) => pointer.replace(pattern, replacement)
  )
]

/** `resolvePointerRange` across the pointer's candidate spellings. */
export const resolvePointerInDocument = (
  jsonText: string,
  pointer: string
): PointerRange | undefined => {
  for (const candidate of pointerCandidates(pointer)) {
    const range = resolvePointerRange(jsonText, candidate)
    if (range !== undefined) return range
  }
  return undefined
}

/** A `ParseIssue.location` is a stringified StackTrail — colon-joined
 *  frames (`:` escaped as `%3A`) of the form
 *  `<traceId>:<spanId>:<phase>:<...document path>`. Strip everything
 *  through the first phase frame and rebuild the rest as a document
 *  pointer (mirrors StackTrail.toSchemaPointer). `undefined` when no
 *  phase frame or no document path remains. */
const PHASE_FRAMES = new Set(['parse', 'generate', 'render', 'post-pass'])

export const trailToSchemaPointer = (location: string): string | undefined => {
  const frames = location.split(':').map(frame => frame.replace(/%3A/g, ':'))
  const phaseIndex = frames.findIndex(frame => PHASE_FRAMES.has(frame))
  if (phaseIndex === -1) return undefined
  const rest = frames.slice(phaseIndex + 1)
  if (rest.length === 0) return undefined
  return `#/${rest.map(segment => segment.replace(/~/g, '~0').replace(/\//g, '~1')).join('/')}`
}

/** Character offset → 0-based line/character, for building editor positions
 *  in documents that aren't open (the schema file on a definition jump). */
export const offsetToLineCol = (
  text: string,
  offset: number
): { line: number; character: number } => {
  let line = 0
  let lineStart = 0
  const end = Math.min(offset, text.length)
  for (let i = 0; i < end; i++) {
    if (text[i] === '\n') {
      line++
      lineStart = i + 1
    }
  }
  return { line, character: end - lineStart }
}
