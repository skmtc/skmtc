import { type GeneratorsMapContainer, toArtifacts } from '@skmtc/core'
import { StackTrail } from '@skmtc/core'
import type { GeneratePayload } from './types.ts'

// Re-export for hosts that want both the runtime entry and the
// payload types from the same module path.
export type { GeneratePayload, WorkerMessage } from './types.ts'

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

          const { artifacts, manifest } = toArtifacts({
            traceId,
            spanId,
            startAt,
            document: payload.document,
            prettier: undefined,
            settings: payload.clientSettings,
            stackTrail,
            toGeneratorConfigMap,
            logsPath: undefined,
            silent: payload.silent ?? false
          })

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
