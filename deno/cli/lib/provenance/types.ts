// Provenance core types. The wire shapes (GenMapEntry/GenMapResult) mirror
// `@skmtc/vite`'s `wire.ts` schemas — hand-mirrored here (the package does
// not export its gen-map reader), same stance as the vite plugin's own
// hand-mirrored sidecar shape. The resolved-anchor shape matches the desktop
// gen-map libs (deno/desktop/src/lib/gen-map/types.ts) so the interval-index
// port operates unchanged.
//
// This directory is the canonical query core over the run's write-products
// (`.maps` sidecars, manifest, client.json) — serving `skmtc trace` /
// `skmtc explain` today and the `skmtc lsp` server later. Uses `node:`
// builtins so the same modules also run under Node (the hub extension).

/** One decoded anchor row — the flat entry shape the hub/desktop viewers consume. */
export type GenMapEntry = {
  /** Manifest-keyed artifact path (basePath-rooted, e.g. `src/types/foo.generated.ts`). */
  artifactPath: string
  /** UTF-16 code-unit offsets into the artifact, half-open `[from, to)`. */
  artifactSpan: [number, number]
  /** Enclosing Definition/landmark name. */
  projectionName: string
  /** The exact producer class that emitted the span (e.g. `ZodObject`). */
  producerName: string
  /** Generator package name, optionally `@version`-suffixed. */
  generatorRef: string
  /** Document-relative RFC 6901 pointer, `''` when unattributed. */
  schemaPointer: string
  variant: string
}

export type GenMapResult = {
  entries: GenMapEntry[]
  /** Artifact paths whose spans could not be aligned or re-anchored. */
  staleFiles: string[]
}

/**
 * Resolved attribution for a single span (UTF-16 code-unit offsets — they
 * coincide with JS string indexing and VSCode offsets, despite the
 * `fromByte`/`toByte` naming inherited from the sidecar format).
 */
export type ResolvedAnchor = {
  fromByte: number
  toByte: number
  /** Enclosing Projection / Definition name the span lives under. */
  landmark: string
  /** The exact producer class that emitted the span. */
  producerName: string
  generator: {
    /** Version-stripped generator id — the grouping key. */
    name: string
    version: string
  }
  schemaPointer: string
  variant: string
}
