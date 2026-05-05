import type { ClientSettings } from '@skmtc/core/Settings'
import type { OpenAPIV3 } from 'openapi-types'

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

/** Fields the host may include on either protocol's payload. */
export type GeneratePayloadShared = {
  clientSettings?: ClientSettings
  silent?: boolean
}

/**
 * Wire shape of the `GENERATE` message payload posted by the host.
 *
 * Discriminated union keyed on `protocol`. Switch-narrowing on
 * `payload.protocol` automatically narrows the rest of the shape, so
 * the worker doesn't need any defensive runtime checks.
 */
export type GeneratePayload =
  | (GeneratePayloadShared & { protocol: 'oas'; documentObject: OpenAPIV3.Document })
  | (GeneratePayloadShared & { protocol: 'gql'; gqlSource: string })

/**
 * Top-level message shape posted to the worker. Currently only one
 * type (`GENERATE`) is defined; future commands would add variants.
 */
export type WorkerMessage = {
  type: 'GENERATE'
  payload: GeneratePayload
}
