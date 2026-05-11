import type { ClientSettings } from '@skmtc/core/Settings'
import type { SkmtcDocumentInput } from '@skmtc/core'

/**
 * Wire-protocol types for `@skmtc/worker`.
 *
 * Lives in its own file (separate from `mod.ts`) so consumers — the
 * host (`@skmtc/cli`), tests, and any future caller — can import the
 * payload type without dragging in the worker runtime code that uses
 * `self.onmessage` / `self.postMessage`. Those references require the
 * `deno.worker` compilerOptions.lib, which non-worker callers don't
 * have configured.
 */

/**
 * Wire shape of the `GENERATE` message payload posted by the host.
 *
 * The `document` field is a {@link SkmtcDocumentInput} discriminated
 * union — `{ type: 'oas', value }` carries the OpenAPI v3 document
 * (already converted to 3.0 host-side via `@skmtc/convert`),
 * `{ type: 'gql', value }` carries the SDL string. The worker hands the
 * union straight to `toArtifacts`, which runs the protocol-specific
 * parser inside the pipeline.
 *
 * GraphQL `SkmtcDocumentInput.gql.value` is the raw SDL string — not a
 * pre-parsed `GqlDocument` — because `GqlDocument` carries class
 * instances and `OasRef` back-refs that don't survive structured clone
 * across the worker boundary. SDL serialises cleanly; the parsed
 * document would not.
 */
export type GeneratePayload = {
  clientSettings?: ClientSettings
  silent?: boolean
  document: SkmtcDocumentInput
}

/**
 * Top-level message shape posted to the worker. Currently only one
 * type (`GENERATE`) is defined; future commands would add variants.
 */
export type WorkerMessage = {
  type: 'GENERATE'
  payload: GeneratePayload
}
