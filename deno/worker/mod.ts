import { match } from 'ts-pattern'
import { type GeneratorsMapContainer, toArtifacts } from '@skmtc/core'

const toWorker = (
  toGeneratorConfigMap: <EnrichmentType>() => GeneratorsMapContainer<EnrichmentType>
) => {
  self.onmessage = async e => {
    const { type, payload } = e.data

    try {
      await match(type)
        .with('PING', () => {
          // Health check
          self.postMessage({
            type: 'PONG',
            generatorIds: Object.keys(toGeneratorConfigMap())
          })
        })
        .with('TRANSFORM', async () => {
          const { documentObject, clientSettings } = payload
          // console.time('TO_V3_DOCUMENT')
          // const documentObject = await toV3Document(stringToSchema(schema))
          // console.timeEnd('TO_V3_DOCUMENT')

          const now = Date.now()

          const { artifacts, manifest } = toArtifacts({
            traceId: `trace-${now}`,
            spanId: `span-${now}`,
            startAt: now,
            documentObject,
            prettier: undefined,
            settings: clientSettings,
            toGeneratorConfigMap,
            logsPath: undefined,
            silent: true
          })

          self.postMessage({
            type: 'RESULT',
            artifacts: artifacts,
            manifest: manifest
          })
        })
        .otherwise(() => {
          self.postMessage({
            type: 'ERROR',
            error: `Unknown message type: ${type}`
          })
        })
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
