/**
 * Attribution (gen-maps) **emission** config.
 *
 * Attribution *location capture* is always on and needs no configuration:
 *
 * - **Parse phase**: every parsed OAS / GQL node snapshots the visitor's
 *   `StackTrail` into its `OasBase` base (`toLocation()` → JSON Pointer).
 * - **Generate phase**: in a run with `postPass`, every `SnippetBase`
 *   instance wraps its `toString` to capture parent/child edges, so the
 *   post-render span resolver can attribute byte ranges to producers. A
 *   run with no `postPass` installs no wrapper.
 *
 * This type configures only **emission**: it is supplied at the run level
 * (`CoreContext.toArtifacts`) and consumed solely by the post-render
 * pass. The parse and generate contexts do not carry it; the generate
 * context only knows whether the run has a capture channel. Without
 * `postPass` you get location capture but no on-disk output; setting
 * `postPass` activates the pass and surfaces `sidecars` /
 * `generationMap` on the result.
 */

import type { ParserAdapter } from '@/anchors/ParserAdapter.ts'
import type { GeneratorMetaLookup } from '@/anchors/postPass.ts'

export type AttributionPostPassConfig = {
  /**
   * Parser adapter used to resolve landmarks + AST paths. Optional —
   * when omitted, the post-pass falls back to using the enclosing
   * Definition's identifier as the landmark and emits an empty AST
   * path. Sidecars still carry byte ranges, attributions, generators,
   * schema pointers, and variants. The worker-side pipeline runs
   * without a parser because native parsers don't bundle cleanly
   * via `deno bundle`; a host-side post-pass can re-run with a
   * parser later when full AST data is needed.
   */
  parser?: ParserAdapter
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
  postPass?: AttributionPostPassConfig
}
