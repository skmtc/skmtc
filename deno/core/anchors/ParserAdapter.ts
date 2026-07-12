/**
 * @fileoverview Parser-agnostic interface for AST descend + landmark
 * resolution. Per plan §8.3.
 *
 * One implementation today (`oxcAdapter`, backed by the Rust
 * oxc-parser via napi). v1 originally landed `tscAdapter` but tsc's
 * npm package can't bundle into a Worker (pulls in
 * `source-map-support`), so we swapped to oxc — Spike 1b had already
 * validated it works in Deno and is ~3.2× faster on raw parse.
 * Consumers (`postPass`, the viewer's re-anchor path, the VSCode
 * extension) import only through this interface so swapping parsers
 * is a one-line change at the wire-up site.
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
   * Index every named top-level declaration — exported or not
   * (`export const X`, bare `const y`, `function f`, `type T`, …) —
   * so subsequent `landmarkFor` calls run in constant time per span.
   * Non-exported declarations are landmarks too: generated files
   * carry module-level consts that spans live under (export-only
   * indexing stranded 7.4% of a real consumer corpus's anchors).
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

  /**
   * Inverse of {@link ascendToLandmark}: descend a recorded
   * child-index path from a landmark node. Returns `undefined` when
   * the path no longer fits (an index past a child list — the file's
   * structure genuinely changed). An empty path returns the landmark
   * itself. This is the re-anchor primitive: resolve the landmark by
   * name in the CURRENT parse, descend the recorded path, read the
   * node's span via {@link spanOf}.
   */
  descendPath(landmark: NodeHandle, path: number[]): NodeHandle | undefined

  /** The `[start, end)` source range of a node (same units the
   *  adapter's parse produced — UTF-16 code units for oxc). */
  spanOf(node: NodeHandle): { start: number; end: number }
}
