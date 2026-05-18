/**
 * Attribution (gen-maps) state. Carried by both `ParseContext` and
 * `GenerateContext`. When `enabled`, the pipeline records position
 * provenance:
 *
 * - **Parse phase**: every parsed OAS / GQL node snapshots the visitor's
 *   `StackTrail` into its `OasBase` base (`toLocation()` → JSON Pointer).
 * - **Generate phase**: every `SnippetBase` instance wraps its
 *   `toString` to capture parent/child edges via a render stack, so
 *   the post-render span resolver can attribute byte ranges to
 *   producers.
 *
 * When `enabled: false` or `attribution` is omitted entirely, neither
 * phase pays any extra cost — the `if (context.attribution)` checks
 * gate the entire opt-in.
 *
 * The optional `postPass` block configures the post-render attribution
 * pass (sidecar + generation-map emission). Setting `enabled: true`
 * alone gives you instrumentation but no on-disk output; adding
 * `postPass` activates the pass and surfaces `sidecars` /
 * `generationMap` on the result.
 * ParseContext ignores `postPass` — it's a generate-phase concern,
 * carried here only so all attribution config lives in one place.
 */

import type { ParserAdapter } from '@/anchors/ParserAdapter.ts'
import type { GeneratorMetaLookup } from '@/anchors/postPass.ts'

export type AttributionPostPassConfig = {
  /** Parser adapter used to resolve landmarks + AST paths. */
  parser: ParserAdapter
  /**
   * Schema source identifier — typically the path or URL the producer
   * ran against (e.g. `'openapi.json'`). Lands on each sidecar's
   * `src` field so re-anchor consumers know which schema produced
   * the file.
   */
  schemaSrc: string
  /**
   * Per-generator metadata lookup. The CLI builds this from the
   * project's `deno.json` + lockfile and threads it in. When absent,
   * generator entries land with empty version + a `jsr.io` registry.
   */
  generatorMeta?: GeneratorMetaLookup
}

export type AttributionState = {
  enabled: boolean
  postPass?: AttributionPostPassConfig
}
