/**
 * @fileoverview {@link ParserAdapter} implementation backed by
 * `oxc-parser` (a native Rust parser exposed via napi). Replaces the
 * `tscAdapter` for v1 because TypeScript's npm package pulls in
 * `source-map-support` at module load, which Deno's bundler can't
 * resolve — so `npm:typescript` makes `core` unbundleable into a
 * Worker. oxc is bundle-clean.
 *
 * Spike 1b (`spike-1b-results.md`) validated oxc in Deno: ~3.2×
 * faster raw parse than tsc, zero integration friction.
 *
 * AST shape notes (oxc-parser ESTree-compatible output):
 *
 * - Every node has `{ type, start, end }`. Byte offsets are 0-based,
 *   half-open `[start, end)`.
 * - `program.body` is the top-level statement array.
 * - `ExportNamedDeclaration` wraps the underlying `declaration`
 *   (TSTypeAliasDeclaration, VariableDeclaration, FunctionDeclaration,
 *   ClassDeclaration, TSInterfaceDeclaration, TSEnumDeclaration).
 * - `VariableDeclaration` has a `declarations` array; each
 *   `VariableDeclarator` has `id: { name }`.
 * - There is no native `forEachChild` equivalent. We treat any nested
 *   object with a `type` field as an AST child, and any array of such
 *   objects as a child list. Traversal order follows `Object.keys`
 *   insertion order — stable for a given oxc version, which is what
 *   `LandmarkLocation.path` requires for re-anchor stability.
 */

import * as oxc from 'oxc-parser'
import type { LandmarkLocation, NodeHandle, ParsedFile, ParserAdapter } from './ParserAdapter.ts'

type OxcNode = {
  type: string
  start: number
  end: number
  // Parent edge populated by `attachParents` so `ascendToLandmark`
  // can walk upward. Non-enumerable to avoid showing up in child
  // traversals.
  _parent?: OxcNode
  // Various AST-specific properties — we treat any nested object
  // with `type` as a child.
  [key: string]: unknown
}

type ParsedHandle = {
  program: OxcNode
}

const oxcVersion = '0.41.0'

const parse: ParserAdapter['parse'] = (filePath, source) => {
  // `parseSync` returns `{ program, module, comments, errors, magicString }`.
  // We only use `program`. Errors are ignored — the post-pass should
  // tolerate partially-parseable output so re-anchoring still works on
  // mostly-valid files.
  const result = oxc.parseSync(filePath, source)
  const program = result.program as unknown as OxcNode
  attachParents(program)
  return { program } satisfies ParsedHandle
}

/**
 * Walk the program and stamp every node with a non-enumerable
 * `_parent` pointer to its enclosing AST node. Mirrors tsc's
 * `setParentNodes: true`.
 */
const attachParents = (root: OxcNode): void => {
  const visit = (node: OxcNode, parent: OxcNode | undefined): void => {
    if (parent) {
      Object.defineProperty(node, '_parent', {
        value: parent,
        enumerable: false,
        writable: true,
        configurable: true
      })
    }
    for (const child of childrenOf(node)) visit(child, node)
  }
  visit(root, undefined)
}

/**
 * Whitespace-only JSXText nodes are formatting artifacts: a JSX
 * reflow (one line ↔ many) inserts or removes them, shifting every
 * sibling's child index. Child-index paths must survive a formatter
 * pass (the whole point of re-anchoring), so traversal indexes over
 * semantic children only. Validated against a full consumer-project
 * corpus in `spike-reanchor.ts` — unfiltered indices broke a
 * systematic cluster of JSX anchors under oxfmt.
 */
const isFormattingArtifact = (node: OxcNode): boolean =>
  node.type === 'JSXText' && typeof node.value === 'string' && node.value.trim() === ''

/** Raw structural children — no formatting normalization. Only
 *  {@link childrenOf} and {@link unwrapParens} may call this. */
const directChildren = (node: OxcNode): OxcNode[] => {
  const out: OxcNode[] = []
  for (const key of Object.keys(node)) {
    if (key === 'type' || key === 'start' || key === 'end' || key === '_parent') continue
    const value = node[key]
    if (isAstNode(value)) {
      out.push(value)
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (isAstNode(item)) out.push(item)
      }
    }
  }
  return out
}

/**
 * Parentheses are pure formatting: a formatter freely adds them (e.g.
 * around a JSX return it reflows to multiple lines) or drops them, and
 * oxc materializes each pair as a `ParenthesizedExpression` node — an
 * extra tree level that would shift every recorded path under it.
 * Traversal treats them as transparent: a paren node is replaced by
 * its inner expression, so paths never see paren levels on either the
 * record or the descend side.
 */
const unwrapParens = (node: OxcNode): OxcNode => {
  if (node.type !== 'ParenthesizedExpression') return node
  const inner = directChildren(node)[0]
  return inner === undefined ? node : unwrapParens(inner)
}

/**
 * Iterate immediate AST children of `node`, normalized for formatting
 * artifacts: whitespace-only JSXText is dropped (see
 * {@link isFormattingArtifact}) and `ParenthesizedExpression` levels
 * are unwrapped (see {@link unwrapParens}). Traversal order is
 * `Object.keys` insertion order. Every traversal — parent stamping,
 * span descent, path record, path descend — goes through this, so the
 * normalized tree is the only tree paths ever index.
 */
const childrenOf = (node: OxcNode): OxcNode[] =>
  directChildren(node)
    .map(unwrapParens)
    .filter(child => !isFormattingArtifact(child))

const isAstNode = (value: unknown): value is OxcNode => {
  return (
    value !== null &&
    typeof value === 'object' &&
    'type' in value &&
    typeof (value as { type: unknown }).type === 'string' &&
    'start' in value &&
    typeof (value as { start: unknown }).start === 'number'
  )
}

/**
 * Collect every top-level export's identifier-keyed handle.
 *
 * Handles the same statement shapes as the tsc adapter:
 * - `export const X = ...` / `export let X = ...` / `export var X = ...`
 *   → one entry per declared binding name.
 * - `export function f(...) {}` / `export class C {}`.
 * - `export type T = ...` / `export interface I {}` / `export enum E {}`.
 *
 * Skipped: anonymous default exports, namespace re-exports, bare
 * `export { X } from './x'` clauses.
 */
const collectLandmarks: ParserAdapter['collectLandmarks'] = file => {
  const landmarks = new Map<string, NodeHandle>()
  const { program } = file as ParsedHandle
  const body = (program.body as OxcNode[] | undefined) ?? []
  for (const stmt of body) {
    // Both `export const X = ...` and bare top-level `const X = ...`
    // are landmarks: generated files carry non-exported module-level
    // declarations (`const columnHelper = ...`) that spans live
    // under — export-only landmarks stranded 7.4% of a consumer
    // corpus's anchors (spike-reanchor.ts). The landmark handle is
    // the top-level statement either way, so recorded paths descend
    // from the same node shape.
    const declarationValue = stmt.type === 'ExportNamedDeclaration' ? stmt.declaration : stmt
    if (!isAstNode(declarationValue)) continue
    const decl = declarationValue
    if (decl.type === 'VariableDeclaration') {
      const declarations = Array.isArray(decl.declarations)
        ? decl.declarations.filter(isAstNode)
        : []
      for (const declarator of declarations) {
        const name = nameOf(declarator.id)
        if (name && !landmarks.has(name)) landmarks.set(name, stmt)
      }
      continue
    }
    if (
      decl.type === 'FunctionDeclaration' ||
      decl.type === 'ClassDeclaration' ||
      decl.type === 'TSTypeAliasDeclaration' ||
      decl.type === 'TSInterfaceDeclaration' ||
      decl.type === 'TSEnumDeclaration'
    ) {
      const name = nameOf(decl.id)
      if (name && !landmarks.has(name)) landmarks.set(name, stmt)
    }
  }
  return landmarks
}

const nameOf = (idNode: unknown): string | undefined => {
  if (!isAstNode(idNode)) return undefined
  if (idNode.type === 'Identifier' && typeof idNode.name === 'string') {
    return idNode.name
  }
  return undefined
}

/**
 * Descend the AST to the smallest node whose byte range fully
 * encloses `[from, to)`. Walks children via {@link childrenOf} so
 * traversal order matches what `ascendToLandmark` later computes
 * the path from.
 */
const smallestEnclosing: ParserAdapter['smallestEnclosing'] = (file, from, to) => {
  const { program } = file as ParsedHandle
  let result: OxcNode = program
  const visit = (node: OxcNode): void => {
    if (node.start <= from && node.end >= to) {
      result = node
      for (const child of childrenOf(node)) visit(child)
    }
  }
  for (const child of childrenOf(program)) visit(child)
  return result
}

/**
 * Walk up from `node` to the nearest landmark via `_parent`. Builds
 * the child-index path bottom-up: each step finds the current node's
 * index in its parent's `childrenOf` ordering and prepends it.
 */
const ascendToLandmark: ParserAdapter['ascendToLandmark'] = (node, landmarks): LandmarkLocation => {
  const reverseLookup = new Map<OxcNode, string>()
  for (const [name, handle] of landmarks) {
    reverseLookup.set(handle as OxcNode, name)
  }

  let current = node as OxcNode
  const path: number[] = []

  while (current && !reverseLookup.has(current)) {
    const parent = current._parent
    if (!parent) {
      return { landmark: '', path: [] }
    }
    const index = childIndex(parent, current)
    if (index === -1) {
      return { landmark: '', path: [] }
    }
    path.unshift(index)
    current = parent
  }

  const landmarkName = reverseLookup.get(current)
  if (!landmarkName) return { landmark: '', path: [] }
  return { landmark: landmarkName, path }
}

const childIndex = (parent: OxcNode, target: OxcNode): number => {
  const children = childrenOf(parent)
  for (let i = 0; i < children.length; i++) {
    if (children[i] === target) return i
  }
  return -1
}

/**
 * Inverse of {@link ascendToLandmark}: descend a recorded child-index
 * path from a landmark node, over the same filtered {@link childrenOf}
 * ordering the ascent indexed. `undefined` when an index no longer
 * fits — the structure genuinely changed since the path was recorded.
 */
const descendPath: ParserAdapter['descendPath'] = (landmark, path) => {
  if (!isAstNode(landmark)) return undefined
  let current = landmark
  for (const index of path) {
    const child = childrenOf(current)[index]
    if (child === undefined) return undefined
    current = child
  }
  return current
}

const spanOf: ParserAdapter['spanOf'] = node => {
  if (!isAstNode(node)) return { start: 0, end: 0 }
  return { start: node.start, end: node.end }
}

/**
 * Singleton adapter. Stateless — same instance is safe to share
 * across many `parse` calls.
 */
export const oxcAdapter: ParserAdapter = {
  id: `oxc@${oxcVersion}`,
  parse,
  collectLandmarks,
  smallestEnclosing,
  ascendToLandmark,
  descendPath,
  spanOf
}

export const __testing = {
  collectLandmarks,
  smallestEnclosing,
  ascendToLandmark,
  childrenOf
}
