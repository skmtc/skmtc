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
 * `generatorId` and `schemaPointer` are derivable from the producer's
 * `generatorKey`; `schemaPointer` may be overridden by the producer's
 * own `srcPtr` field for fine-grained schema pointers. `variant`
 * defaults to `'main'`. `definitionName` is populated for Definition
 * producers.
 *
 * `genVersion` is deferred — wired up in Phase D when the CLI knows
 * each entry's `denoJson.version`.
 */
export type Attribution = {
  generatorId: string
  schemaPointer: string | undefined
  variant: string
  definitionName: string | undefined
  /**
   * The producer's own class name (e.g. `ZodObject`, `StringInput`) —
   * the *exact* Projection or Snippet that emitted the span, distinct
   * from `definitionName` (the enclosing Definition). Derived from
   * `producer.constructor.name`, which survives `deno bundle` via JS
   * named evaluation (`var X = class extends …` → `X.name === 'X'`).
   * Empty string when unavailable.
   */
  producerName: string
}
