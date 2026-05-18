import { type GeneratorsMapContainer, toArtifacts } from '@skmtc/core'
import { StackTrail } from '@skmtc/core'
import { tscAdapter } from '@skmtc/core/Anchors'
import type { AttributionState } from '@skmtc/core/AttributionState'
import type { GeneratePayload, SerializableAttribution } from './types.ts'

// Re-export for hosts that want both the runtime entry and the
// payload types from the same module path.
export type {
  GeneratePayload,
  WorkerMessage,
  WorkerResult,
  SerializableAttribution
} from './types.ts'

/**
 * Reconstruct the full `AttributionState` from the serialisable
 * subset that crossed the worker boundary. Returns `undefined` when
 * the payload didn't include an attribution config — the worker
 * passes that straight through to `toArtifacts`.
 *
 * The non-serialisable bits get reconstituted here:
 *  - `parser` defaults to `tscAdapter` (v1 only ships tsc).
 *  - `generatorMeta` becomes a lookup function over the plain
 *    `Record<genId, {version, registry}>` map, with a graceful
 *    fallback for unknown ids.
 */
const buildAttributionState = (
  serialised: SerializableAttribution | undefined
): AttributionState | undefined => {
  if (!serialised) return undefined
  if (!serialised.postPass) {
    return { enabled: serialised.enabled }
  }

  const { schemaSrc, generatorMeta } = serialised.postPass
  return {
    enabled: serialised.enabled,
    postPass: {
      parser: tscAdapter,
      schemaSrc,
      generatorMeta: generatorMeta
        ? (genId: string) =>
            generatorMeta[genId] ?? {
              version: '',
              registry: { host: 'jsr.io', kind: 'jsr' as const }
            }
        : undefined
    }
  }
}

/**
 * Worker entry that runs the SKMTC code-generation pipeline in a
 * background thread.
 *
 * The worker accepts a single `GENERATE` message whose payload carries
 * a {@link SkmtcDocumentInput} `document` field. `toArtifacts` runs the
 * protocol-specific parse step inside the pipeline based on
 * `document.type` — the worker itself doesn't branch on protocol.
 *
 * `parseIssues` are nested inside the manifest now; the worker forwards
 * the manifest as-is and no separate field travels on the wire.
 *
 * When `payload.attribution.postPass` is set, the worker also
 * reconstitutes the full `AttributionState` (with `tscAdapter` + a
 * lookup fn rebuilt from the plain `generatorMeta` map) and forwards
 * the resulting `sidecars` + `generationMap` in the RESULT message.
 */
const toWorker = (
  toGeneratorConfigMap: <EnrichmentType = undefined>() => GeneratorsMapContainer<EnrichmentType>
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

          const { artifacts, manifest, sidecars, generationMap } = toArtifacts({
            traceId,
            spanId,
            startAt,
            document: payload.document,
            settings: payload.clientSettings,
            stackTrail,
            toGeneratorConfigMap,
            logsPath: undefined,
            silent: payload.silent ?? false,
            attribution: buildAttributionState(payload.attribution)
          })

          self.postMessage({
            type: 'RESULT',
            artifacts,
            manifest,
            sidecars,
            generationMap
          })
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

// Expose buildAttributionState for unit-testing without spawning a worker.
export { buildAttributionState }

export default toWorker
