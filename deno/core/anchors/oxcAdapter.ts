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
 * Iterate immediate AST children of `node`. A child is any nested
 * value (or array element) that is itself an object with a `type`
 * field. Traversal order is `Object.keys` insertion order.
 */
const childrenOf = (node: OxcNode): OxcNode[] => {
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
const collectLandmarks: ParserAdapter['collectLandmarks'] = (file) => {
  const landmarks = new Map<string, NodeHandle>()
  const { program } = file as ParsedHandle
  const body = (program.body as OxcNode[] | undefined) ?? []
  for (const stmt of body) {
    if (stmt.type !== 'ExportNamedDeclaration') continue
    const decl = stmt.declaration as OxcNode | undefined
    if (!decl) continue
    if (decl.type === 'VariableDeclaration') {
      const declarations = (decl.declarations as OxcNode[] | undefined) ?? []
      for (const d of declarations) {
        const name = nameOf(d.id as OxcNode | undefined)
        if (name) landmarks.set(name, stmt)
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
      const name = nameOf(decl.id as OxcNode | undefined)
      if (name) landmarks.set(name, stmt)
    }
  }
  return landmarks
}

const nameOf = (idNode: OxcNode | undefined): string | undefined => {
  if (!idNode) return undefined
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
const ascendToLandmark: ParserAdapter['ascendToLandmark'] = (
  node,
  landmarks
): LandmarkLocation => {
  const reverseLookup = new Map<OxcNode, string>()
  for (const [name, handle] of landmarks) reverseLookup.set(handle as OxcNode, name)

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
 * Singleton adapter. Stateless — same instance is safe to share
 * across many `parse` calls.
 */
export const oxcAdapter: ParserAdapter = {
  id: `oxc@${oxcVersion}`,
  parse,
  collectLandmarks,
  smallestEnclosing,
  ascendToLandmark
}

export const __testing = { collectLandmarks, smallestEnclosing, ascendToLandmark, childrenOf }
