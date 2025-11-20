import { type GeneratorsMapContainer, toArtifacts } from '@skmtc/core'
import { StackTrail } from '@skmtc/core'

const toWorker = (
  toGeneratorConfigMap: <EnrichmentType>() => GeneratorsMapContainer<EnrichmentType>
) => {
  self.onmessage = async e => {
    const { type, payload } = e.data

    try {
      switch (type) {
        case 'GENERATE': {
          const { documentObject, clientSettings, silent } = payload

          const now = Date.now()
          const traceId = `trace-${now}`
          const spanId = `span-${now}`

          const stackTrail = new StackTrail([traceId, spanId])

          const { artifacts, manifest } = toArtifacts({
            traceId,
            spanId,
            startAt: now,
            documentObject,
            prettier: undefined,
            settings: clientSettings,
            stackTrail,
            toGeneratorConfigMap,
            logsPath: undefined,
            silent: silent ?? false
          })

          self.postMessage({
            type: 'RESULT',
            artifacts: artifacts,
            manifest: manifest
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

export default toWorker
