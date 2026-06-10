import type { ClientSettings } from '@skmtc/core/Settings'
import type { SkmtcDocumentInput } from '@skmtc/core'
import type { RegistryEntry, Sidecar, GenerationMapEntry } from '@skmtc/core/Anchors'
import type { ManifestContent } from '@skmtc/core/Manifest'

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
 * Serialisable subset of `AttributionState` that can cross the worker
 * `postMessage` boundary.
 *
 * `AttributionState` itself holds a `parser` (`ParserAdapter` —
 * object with function methods) and a `generatorMeta` lookup
 * function. Neither survives structured clone. The wire shape
 * replaces both with plain data:
 *
 * - `parser` is reconstructed worker-side as the pinned `oxcAdapter`
 *   from `@skmtc/core/Anchors`. v1 only supports tsc; when oxc lands
 *   (plan §8) this shape grows a `parser: 'tsc' | 'oxc'` discriminator.
 * - `generatorMeta` is replaced by a flat `Record<genId, {version,
 *   registry}>` map. The worker rebuilds it into a lookup fn that
 *   falls back to the default when an unknown `genId` is queried.
 */
export type SerializableAttribution = {
  postPass?: {
    schemaSrc: string
    generatorMeta?: Record<string, { version: string; registry: RegistryEntry }>
  }
}

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
 * across the worker boundary. SDL serializes cleanly; the parsed
 * document would not.
 */
export type GeneratePayload = {
  clientSettings?: ClientSettings
  silent?: boolean
  document: SkmtcDocumentInput
  /**
   * Optional attribution (gen-maps) emission config. When a `postPass`
   * block is present, the worker runs the post-pass and includes
   * `sidecars` + `generationMap` in the RESULT message. (Capture is
   * always on in core; this only controls emission.)
   */
  attribution?: SerializableAttribution
}

/**
 * Top-level message shape posted to the worker. Currently only one
 * type (`GENERATE`) is defined; future commands would add variants.
 */
export type WorkerMessage = {
  type: 'GENERATE'
  payload: GeneratePayload
}

/**
 * Wire shape of the worker's RESULT message back to the host. Mirrors
 * the relevant `ToArtifactsResult` fields. `sidecars` + `generationMap`
 * are present only when the payload's `attribution.postPass` was set.
 */
export type WorkerResult = {
  type: 'RESULT'
  artifacts: Record<string, string>
  manifest: ManifestContent
  sidecars?: Record<string, Sidecar>
  generationMap?: GenerationMapEntry[]
}
