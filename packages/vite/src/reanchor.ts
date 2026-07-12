// Re-anchor sidecar spans onto a formatted file. The engine records each
// anchor's landmark (top-level declaration name) + AST child-index path
// against the RAW render (`@skmtc/core`'s host-side post-pass); when a
// project formatter reshapes the file, byte spans go stale but the AST
// structure doesn't — resolve the landmark in the CURRENT parse, descend
// the recorded path, and read fresh offsets.
//
// Mirrors `@skmtc/core/Anchors`' oxcAdapter traversal semantics — the
// `Object.keys`-ordered child walk, whitespace-only-JSXText filtering, and
// all-top-level-declaration landmarks — WITHOUT importing core, the same
// stance as gen-map.ts's hand-mirrored sidecar shape. The oxc-parser
// version is pinned to the one core's adapter stamps into `sidecar.parser`
// (`oxc@0.41.0`): a version drift can reorder AST keys and silently break
// recorded paths, so keep the pin and the adapter in lockstep.

import { parseSync } from 'oxc-parser'

type OxcNode = {
  type: string
  start: number
  end: number
  [key: string]: unknown
}

const isAstNode = (value: unknown): value is OxcNode =>
  value !== null &&
  typeof value === 'object' &&
  'type' in value &&
  typeof (value as { type: unknown }).type === 'string' &&
  'start' in value &&
  typeof (value as { start: unknown }).start === 'number'

/** Whitespace-only JSXText nodes are formatting artifacts — a JSX reflow
 *  inserts/removes them, shifting sibling indices. Paths index over
 *  semantic children only (must match the core adapter exactly). */
const isFormattingArtifact = (node: OxcNode): boolean =>
  node.type === 'JSXText' && typeof node.value === 'string' && node.value.trim() === ''

const childrenOf = (node: OxcNode): OxcNode[] => {
  const out: OxcNode[] = []
  for (const key of Object.keys(node)) {
    if (key === 'type' || key === 'start' || key === 'end') continue
    const value = node[key]
    if (isAstNode(value)) out.push(value)
    else if (Array.isArray(value)) {
      for (const item of value) {
        if (isAstNode(item)) out.push(item)
      }
    }
  }
  return out.filter(child => !isFormattingArtifact(child))
}

const nameOf = (idNode: unknown): string | undefined => {
  if (!isAstNode(idNode)) return undefined
  return idNode.type === 'Identifier' && typeof idNode.name === 'string' ? idNode.name : undefined
}

/** Every named top-level declaration, exported or not — keyed to its
 *  top-level statement node (the shape recorded paths descend from). */
const collectLandmarks = (program: OxcNode): Map<string, OxcNode> => {
  const landmarks = new Map<string, OxcNode>()
  const body = Array.isArray(program.body) ? program.body.filter(isAstNode) : []
  for (const statement of body) {
    const declarationValue =
      statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement
    if (!isAstNode(declarationValue)) continue
    if (declarationValue.type === 'VariableDeclaration') {
      const declarations = Array.isArray(declarationValue.declarations)
        ? declarationValue.declarations.filter(isAstNode)
        : []
      for (const declarator of declarations) {
        const name = nameOf(declarator.id)
        if (name && !landmarks.has(name)) landmarks.set(name, statement)
      }
      continue
    }
    if (
      declarationValue.type === 'FunctionDeclaration' ||
      declarationValue.type === 'ClassDeclaration' ||
      declarationValue.type === 'TSTypeAliasDeclaration' ||
      declarationValue.type === 'TSInterfaceDeclaration' ||
      declarationValue.type === 'TSEnumDeclaration'
    ) {
      const name = nameOf(declarationValue.id)
      if (name && !landmarks.has(name)) landmarks.set(name, statement)
    }
  }
  return landmarks
}

/** Per-anchor re-anchor outcome — a closed union for ts-pattern matching. */
export type ReanchorOutcome =
  | { type: 'resolved'; span: [number, number] }
  | { type: 'landmark-missing' }
  | { type: 'path-broken' }

export type ReanchorFile = {
  reanchor: (landmark: string, path: number[]) => ReanchorOutcome
}

/** Sidecar spans are UTF-16 code units; oxc offsets are UTF-8 bytes. They
 *  only coincide for ASCII text, so non-ASCII files can't be re-anchored
 *  without a unit conversion (not yet built — such files stay stale). */
const isAscii = (text: string): boolean => /^[\x00-\x7F]*$/.test(text)

/**
 * Parse a formatted artifact for re-anchoring. `undefined` when the file
 * can't support it (non-ASCII, or the parse produced no usable program) —
 * the caller reports the file stale, exactly as before re-anchoring existed.
 */
export const parseForReanchor = (filePath: string, source: string): ReanchorFile | undefined => {
  if (!isAscii(source)) return undefined
  let program: unknown
  try {
    program = parseSync(filePath, source).program
  } catch {
    return undefined
  }
  if (!isAstNode(program)) return undefined
  const landmarks = collectLandmarks(program)

  return {
    reanchor: (landmark, path) => {
      const landmarkNode = landmarks.get(landmark)
      if (landmarkNode === undefined) return { type: 'landmark-missing' }
      let current = landmarkNode
      for (const index of path) {
        const child = childrenOf(current)[index]
        if (child === undefined) return { type: 'path-broken' }
        current = child
      }
      return { type: 'resolved', span: [current.start, current.end] }
    }
  }
}
