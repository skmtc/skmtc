// Ported from skmtc `packages/vite/src/reanchor.ts` (verbatim port — keep in
// lockstep; the oxc-parser pin and the parser id below must match what
// `@skmtc/core`'s adapter stamps into `sidecar.parser`).
//
// Re-anchor sidecar spans onto a formatted file. The engine records each
// anchor's landmark (top-level declaration name) + AST child-index path
// against the RAW render (`@skmtc/core`'s host-side post-pass); when a
// project formatter reshapes the file, byte spans go stale but the AST
// structure doesn't — resolve the landmark in the CURRENT parse, descend
// the recorded path, and read fresh offsets.

/** The parser id this module can trust recorded AST paths from — must
 *  match both the pinned `oxc-parser` dependency version and the id
 *  `@skmtc/core`'s adapter stamps into `sidecar.parser`. Paths from any
 *  other parser (or the worker's `'none'`) may index a differently-keyed
 *  AST and descend to the WRONG node, so consumers must fall back to
 *  landmark-only resolution for them. */
export const REANCHOR_PARSER_ID = 'oxc@0.41.0'

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

/** Raw structural children — only `childrenOf`/`unwrapParens` call this. */
const directChildren = (node: OxcNode): OxcNode[] => {
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
  return out
}

/** Parens are pure formatting (freely added/dropped, e.g. around a JSX
 *  return reflowed to multiple lines); oxc materializes each pair as a
 *  `ParenthesizedExpression` level that would shift recorded paths.
 *  Treat them as transparent — must match the core adapter exactly. */
const unwrapParens = (node: OxcNode): OxcNode => {
  if (node.type !== 'ParenthesizedExpression') return node
  const inner = directChildren(node)[0]
  return inner === undefined ? node : unwrapParens(inner)
}

const childrenOf = (node: OxcNode): OxcNode[] =>
  directChildren(node)
    .map(unwrapParens)
    .filter(child => !isFormattingArtifact(child))

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

/** Per-anchor re-anchor outcome — a closed union for exhaustive switching. */
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
// deno-lint-ignore no-control-regex -- the control range IS the ASCII guard
const isAscii = (text: string): boolean => /^[\x00-\x7F]*$/.test(text)

/** `oxc-parser` is a napi native package — on a platform where the
 *  binding didn't install (pruned optionalDependencies, unsupported
 *  arch) a static import would crash the whole extension at load time.
 *  Import lazily on the first drift-path hit and degrade to stale-file
 *  behavior when unavailable. */
type OxcParserModule = typeof import('oxc-parser')
let oxcModulePromise: Promise<OxcParserModule | undefined> | undefined
const loadOxcParser = (): Promise<OxcParserModule | undefined> => {
  oxcModulePromise ??= import('oxc-parser').catch(() => undefined)
  return oxcModulePromise
}

/**
 * Parse a formatted artifact for re-anchoring. `undefined` when the file
 * can't support it (non-ASCII, the native parser isn't available on this
 * platform, or the parse produced no usable program) — the caller reports
 * the file stale, exactly as before re-anchoring existed.
 */
export const parseForReanchor = async (
  filePath: string,
  source: string
): Promise<ReanchorFile | undefined> => {
  if (!isAscii(source)) return undefined
  const oxc = await loadOxcParser()
  if (oxc === undefined) return undefined
  let program: unknown
  try {
    program = oxc.parseSync(filePath, source).program
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
