import type { ManifestContent } from '@skmtc/core/Manifest'
import { toV3Document, stringToSchema } from '@skmtc/convert'
import type { ClientSettings } from '@skmtc/core/Settings'

export type GenerateResponse = {
  artifacts: Record<string, string>
  manifest: ManifestContent
}

export const description =
  'Web worker proof of concept - test generator execution in isolated worker'

type GenerateWithWorkerArgs = {
  schemaContents: string
  clientSettings: ClientSettings | undefined
  workerPath: string
}

export const generateWithWorker = ({
  schemaContents,
  clientSettings,
  workerPath
}: GenerateWithWorkerArgs): Promise<GenerateResponse> => {
  const workerUrl = new URL(workerPath, import.meta.url)

  const worker = new Worker(workerUrl.href, {
    type: 'module',
    deno: {
      permissions: {
        read: true,
        net: false,
        write: true,
        env: true,
        run: false
      }
    }
  })

  return new Promise((resolve, reject) => {
    // Set up message handler
    worker.onmessage = async (e: MessageEvent) => {
      const { type } = e.data

      switch (type) {
        case 'READY': {
          const documentObject = await toV3Document(stringToSchema(schemaContents))

          worker.postMessage({
            type: 'GENERATE',
            payload: { documentObject, clientSettings }
          })
          break
        }

        case 'RESULT': {
          // Cleanup
          worker.terminate()
          resolve(e.data)
          break
        }

        case 'ERROR': {
          console.error('❌ Worker error:', e.data.error)
          worker.terminate()

          reject(new Error(e.data))
          break
        }
      }
    }

    worker.onerror = ({ error }) => {
      console.error('❌ Worker error:', error)

      reject(new Error(error))
    }
  })
}
