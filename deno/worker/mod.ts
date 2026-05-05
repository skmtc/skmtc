import { type GeneratorsMapContainer, toArtifacts } from '@skmtc/core'
import { toArtifactsFromGraphQL } from '@skmtc/core/parsers/graphql'
import { StackTrail } from '@skmtc/core'
import type { ManifestContent } from '@skmtc/core/Manifest'
import type { ClientSettings } from '@skmtc/core/Settings'
import type { OpenAPIV3 } from 'openapi-types'
import type { GeneratePayload, WorkerMessage } from './types.ts'

// Re-export for hosts that want both the runtime entry and the
// payload types from the same module path.
export type { GeneratePayload, GeneratePayloadShared, WorkerMessage } from './types.ts'

type GenerateResult = {
  artifacts: Record<string, string>
  manifest: ManifestContent
}

/** Fields shared by every protocol-specific run. */
type SharedRunArgs = {
  clientSettings: ClientSettings | undefined
  silent: boolean
  traceId: string
  spanId: string
  startAt: number
  stackTrail: StackTrail
  toGeneratorConfigMap: <EnrichmentType>() => GeneratorsMapContainer<EnrichmentType>
}

/**
 * Discriminated args for {@link runArtifacts}. The `protocol` tag
 * controls which protocol-specific input is required; switch-narrowing
 * on it inside `runArtifacts` narrows the input field automatically.
 */
type RunArgs =
  | (SharedRunArgs & { protocol: 'oas'; documentObject: OpenAPIV3.Document })
  | (SharedRunArgs & { protocol: 'gql'; gqlSource: string })

/**
 * Routes a `GENERATE` payload to the right core entry point based on
 * its protocol. Switch is exhaustive over the discriminated args;
 * adding a new protocol forces a compile error here.
 */
const runArtifacts = (args: RunArgs): GenerateResult => {
  switch (args.protocol) {
    case 'gql':
      return toArtifactsFromGraphQL({
        traceId: args.traceId,
        spanId: args.spanId,
        startAt: args.startAt,
        source: args.gqlSource,
        prettier: undefined,
        settings: args.clientSettings,
        stackTrail: args.stackTrail,
        toGeneratorConfigMap: args.toGeneratorConfigMap,
        logsPath: undefined,
        silent: args.silent
      })
    case 'oas':
      return toArtifacts({
        traceId: args.traceId,
        spanId: args.spanId,
        startAt: args.startAt,
        documentObject: args.documentObject,
        prettier: undefined,
        settings: args.clientSettings,
        stackTrail: args.stackTrail,
        toGeneratorConfigMap: args.toGeneratorConfigMap,
        logsPath: undefined,
        silent: args.silent
      })
    default: {
      const _exhaustive: never = args
      throw new Error(`Unhandled protocol in runArtifacts: ${JSON.stringify(_exhaustive)}`)
    }
  }
}


/**
 * Worker entry that runs the SKMTC code-generation pipeline in a
 * background thread.
 *
 * The worker accepts two source kinds via the `GENERATE` message,
 * discriminated by `payload.protocol`:
 *
 * - `'oas'`: `payload.documentObject` is an `OpenAPIV3.Document`
 *   (the host has already converted Swagger / OAS 3.1 → 3.0 via
 *   `@skmtc/convert`). The worker hands it to `toArtifacts`.
 *
 * - `'gql'`: `payload.gqlSource` is a GraphQL SDL string. The worker
 *   parses it via `toArtifactsFromGraphQL`, which produces a
 *   `GqlDocument` and runs the same generate + render phases.
 *
 * GraphQL parsing happens inside the worker rather than at the host
 * because `GqlDocument` carries class instances and `OasRef` back-refs
 * that don't survive structured clone. The SDL string serialises
 * cleanly; the parsed object would not.
 */
const toWorker = (
  toGeneratorConfigMap: <EnrichmentType>() => GeneratorsMapContainer<EnrichmentType>
) => {
  self.onmessage = (e: MessageEvent) => {
    const { type, payload } = e.data as {
      type: string
      payload: GeneratePayload
    }

    try {
      switch (type) {
        case 'GENERATE': {
          const startAt = Date.now()
          const traceId = `trace-${startAt}`
          const spanId = `span-${startAt}`
          const stackTrail = new StackTrail([traceId, spanId])

          const shared: SharedRunArgs = {
            clientSettings: payload.clientSettings,
            silent: payload.silent ?? false,
            traceId,
            spanId,
            startAt,
            stackTrail,
            toGeneratorConfigMap
          }

          // Build the discriminated RunArgs by switching on the
          // payload's protocol. No optional-field validation needed —
          // GeneratePayload's discriminator already guarantees each
          // branch carries the right input.
          const runArgs: RunArgs = ((): RunArgs => {
            switch (payload.protocol) {
              case 'gql':
                return { ...shared, protocol: 'gql', gqlSource: payload.gqlSource }
              case 'oas':
                return { ...shared, protocol: 'oas', documentObject: payload.documentObject }
              default: {
                const _exhaustive: never = payload
                throw new Error(`Unhandled protocol: ${JSON.stringify(_exhaustive)}`)
              }
            }
          })()

          const { artifacts, manifest } = runArtifacts(runArgs)

          self.postMessage({ type: 'RESULT', artifacts, manifest })
          break
        }
        default: {
          self.postMessage({
            type: 'ERROR',
            error: `Unknown message type: ${type}`
          })
          break
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        self.postMessage({
          type: 'ERROR',
          error: error.message || String(error),
          stack: error.stack
        })
      } else {
        self.postMessage({
          type: 'ERROR',
          error: String(error)
        })
      }
    }
  }

  // Signal ready
  self.postMessage({ type: 'READY', generatorIds: Object.keys(toGeneratorConfigMap()) })
}

export default toWorker
