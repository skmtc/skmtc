/**
 * @fileoverview Shared types for the post-render attribution layer.
 *
 * Lives separately from `resolveSpans.ts` / `attribute.ts` so consumers
 * (Phase C sidecar emission, the viewer in Phase E, the VSCode
 * extension in Phase F) can import the types without pulling in any
 * implementation code.
 */

import type { SnippetBase } from '@/dsl/SnippetBase.ts'

/**
 * Byte range within a rendered File that a single producer contributed.
 *
 * `from` and `to` are inclusive-exclusive offsets into
 * `file.toString()`. `producer` is the Snippet or Definition whose
 * `_rendered` cache matched that substring during walk.
 */
export type Span = {
  from: number
  to: number
  producer: SnippetBase
}

/**
 * Attribution tuple derived from a producer.
 *
 * `genId` and `srcPtr` are derivable from the producer's
 * `generatorKey`; `srcPtr` may be overridden by the producer's own
 * `srcPtr` field for fine-grained schema pointers. `variant` defaults
 * to `'main'`. `defName` is populated for Definition producers.
 *
 * `genVersion` is deferred — wired up in Phase D when the CLI knows
 * each entry's `denoJson.version`.
 */
export type Attribution = {
  genId: string
  srcPtr: string | undefined
  variant: string
  defName: string | undefined
}
