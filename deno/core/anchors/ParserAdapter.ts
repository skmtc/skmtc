/**
 * @fileoverview Parser-agnostic interface for AST descend + landmark
 * resolution. Per plan §8.3.
 *
 * One implementation today (`tscAdapter`); `oxc` plugs in later
 * behind the same interface. Consumers (`postPass`, the viewer's
 * re-anchor path, the VSCode extension) import only through this
 * interface so swapping parsers is a one-line change at the wire-up
 * site.
 *
 * The interface is intentionally narrow — just what the post-pass
 * and re-anchor flows need. Each adapter keeps its own node
 * representation (`NodeHandle` is opaque to consumers) and exposes
 * the operations below.
 */

/**
 * Opaque per-adapter node reference. Consumers never inspect the
 * inside; they pass handles through {@link ParserAdapter} operations
 * that take care of the adapter-specific shape.
 */
export type NodeHandle = unknown

/**
 * Parsed file handle. Same opacity story as {@link NodeHandle}.
 */
export type ParsedFile = unknown

/**
 * Landmark name + AST path tuple. `landmark` is the top-level export
 * name (`'User'`, `'createUser'`) the span lives under; `path` is a
 * `forEachChild`-indexed descent from the landmark to the span's
 * narrowest enclosing node. Empty `landmark` means "outside any
 * landmark"; the consumer of {@link buildSidecar} treats that as a
 * skip.
 */
export type LandmarkLocation = {
  landmark: string
  path: number[]
}

/**
 * Adapter contract. Implementations stay pure — no I/O, no global
 * state. The conformance suite in plan §8.4 runs against each.
 */
export interface ParserAdapter {
  /**
   * Display id for the adapter — `"tsc@5.6.3"`, `"oxc@0.x.y"`. Lands
   * on the sidecar's `parser` field so re-anchor consumers can warn
   * on mismatch.
   */
  readonly id: string

  /** Parse a source string. Throws on syntax errors. */
  parse(filePath: string, source: string): ParsedFile

  /**
   * Index every top-level export (`export const X`, `export function
   * f`, `export type T`, default export, etc.) so subsequent
   * `landmarkFor` calls run in constant time per span.
   */
  collectLandmarks(file: ParsedFile): Map<string, NodeHandle>

  /**
   * Descend through children to the smallest AST node whose byte
   * range fully encloses `[from, to)`. Returns the file's root if
   * nothing more specific contains the range.
   */
  smallestEnclosing(file: ParsedFile, from: number, to: number): NodeHandle

  /**
   * Walk up from `node` to the nearest landmark (by entry in the
   * `landmarks` map). Returns the landmark's export name plus the
   * forEachChild-indexed path from the landmark down to `node`.
   *
   * If no landmark is found in the ancestor chain, returns
   * `{ landmark: '', path: [] }` — sentinel "outside any landmark".
   */
  ascendToLandmark(node: NodeHandle, landmarks: Map<string, NodeHandle>): LandmarkLocation
}
