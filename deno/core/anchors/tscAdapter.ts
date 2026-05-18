/**
 * @fileoverview {@link ParserAdapter} implementation backed by the
 * official TypeScript compiler.
 *
 * Phase G plan: extract to `@skmtc/anchor-tsc` JSR package. For v1
 * it lives in `core/anchors/` because the post-pass currently runs
 * inline in `toArtifacts`. Keeping it as a single file makes the
 * future extraction a `git mv` rather than a refactor — the public
 * interface is just {@link ParserAdapter}.
 *
 * Implementation notes:
 *
 * - `ts.createSourceFile` is called with `setParentNodes: true` so
 *   `ascendToLandmark` can walk parents without rebuilding the tree.
 * - `forEachChild` (not `getChildren()`) drives the descent. The
 *   former visits only meaningful AST nodes; the latter includes
 *   punctuation/trivia tokens whose presence drifts between
 *   formatters and would break re-anchoring.
 * - Landmark detection currently keys on the `name` of the first
 *   declaration in each top-level export. Anonymous default exports
 *   and namespace exports are intentionally excluded — they'd map to
 *   an unstable "default" key that re-anchor consumers couldn't
 *   match.
 */

import ts from 'typescript'
import type { LandmarkLocation, NodeHandle, ParsedFile, ParserAdapter } from './ParserAdapter.ts'

const tscVersion = ts.version

const parse: ParserAdapter['parse'] = (filePath, source) =>
  ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    pickScriptKind(filePath)
  )

const pickScriptKind = (filePath: string): ts.ScriptKind => {
  if (filePath.endsWith('.tsx')) return ts.ScriptKind.TSX
  if (filePath.endsWith('.jsx')) return ts.ScriptKind.JSX
  if (filePath.endsWith('.js')) return ts.ScriptKind.JS
  return ts.ScriptKind.TS
}

/**
 * Collect every top-level export's identifier-keyed handle.
 *
 * Handles three statement shapes:
 * - `export const X = ...` / `export let X = ...` / `export var X = ...`
 *   → one entry per declared binding name.
 * - `export function f(...) {}` / `export class C {}` → entry under
 *   the declaration's name.
 * - `export type T = ...` / `export interface I {}` /
 *   `export enum E {}` → entry under the declaration's name.
 *
 * Skipped: anonymous default exports (`export default ...`), namespace
 * exports (`export * from`), re-export statements (`export { X } from
 * './x'`). These don't produce a stable identifier-keyed landmark and
 * the post-pass would have to invent index-based names — see plan #24.
 */
const collectLandmarks: ParserAdapter['collectLandmarks'] = (file) => {
  const landmarks = new Map<string, NodeHandle>()
  const sf = file as ts.SourceFile

  ts.forEachChild(sf, (node) => {
    if (!isExported(node)) return

    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (decl.name && ts.isIdentifier(decl.name)) {
          landmarks.set(decl.name.text, node)
        }
      }
      return
    }

    if (
      (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) &&
      node.name
    ) {
      landmarks.set(node.name.text, node)
      return
    }

    if (
      (ts.isTypeAliasDeclaration(node) ||
        ts.isInterfaceDeclaration(node) ||
        ts.isEnumDeclaration(node)) &&
      node.name
    ) {
      landmarks.set(node.name.text, node)
      return
    }
  })

  return landmarks
}

const isExported = (node: ts.Node): boolean => {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined
  return modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false
}

/**
 * Descend the AST to the smallest node whose byte range fully
 * encloses `[from, to)`. Drives the descent with `forEachChild` so
 * punctuation tokens don't influence the path.
 */
const smallestEnclosing: ParserAdapter['smallestEnclosing'] = (file, from, to) => {
  const sf = file as ts.SourceFile
  let result: ts.Node = sf

  const visit = (node: ts.Node): void => {
    if (node.getStart(sf) <= from && node.getEnd() >= to) {
      result = node
      ts.forEachChild(node, visit)
    }
  }
  ts.forEachChild(sf, visit)

  return result
}

/**
 * Walk up from `node` to the nearest landmark. Computes the
 * `forEachChild` path index from the landmark down to `node` during
 * the ascent.
 *
 * Builds the path bottom-up by re-running `forEachChild` on each
 * parent to find the current node's child index, then prepends.
 * `forEachChild`'s order is stable for a given AST, so the path
 * survives re-parses of the same source.
 */
const ascendToLandmark: ParserAdapter['ascendToLandmark'] = (
  node,
  landmarks
): LandmarkLocation => {
  const reverseLookup = new Map<ts.Node, string>()
  for (const [name, handle] of landmarks) reverseLookup.set(handle as ts.Node, name)

  let current = node as ts.Node
  const path: number[] = []

  while (current && !reverseLookup.has(current)) {
    const parent = current.parent
    if (!parent) {
      // Reached the SourceFile without finding a landmark.
      return { landmark: '', path: [] }
    }
    const index = childIndex(parent, current)
    if (index === -1) {
      // Defensive: parent didn't yield current via forEachChild. Treat
      // as no landmark rather than report a wrong path.
      return { landmark: '', path: [] }
    }
    path.unshift(index)
    current = parent
  }

  const landmarkName = reverseLookup.get(current)
  if (!landmarkName) return { landmark: '', path: [] }
  return { landmark: landmarkName, path }
}

const childIndex = (parent: ts.Node, target: ts.Node): number => {
  let idx = 0
  let found = -1
  ts.forEachChild(parent, (child) => {
    if (child === target) {
      found = idx
      return true // bail out early
    }
    idx++
    return undefined
  })
  return found
}

/**
 * The shared, singleton tsc adapter. Stateless — same instance is
 * safe to share across many `parse` calls.
 */
export const tscAdapter: ParserAdapter = {
  id: `tsc@${tscVersion}`,
  parse,
  collectLandmarks,
  smallestEnclosing,
  ascendToLandmark
}

export const __testing = { collectLandmarks, smallestEnclosing, ascendToLandmark }

export type { ParsedFile, NodeHandle, LandmarkLocation }
