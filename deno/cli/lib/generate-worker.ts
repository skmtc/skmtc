import type { ClientSettings } from '@skmtc/core/Settings'
import type { SerializableAttribution } from '@skmtc/worker/types'
import { toDocumentInput } from '@/lib/document-input.ts'
import type { GenerateResponse } from '@/types/generateResponse.ts'

// Re-export so existing callers (e.g. `services/generateSandboxApi.ts`)
// can continue importing `GenerateResponse` from this module without
// churn.
export type { GenerateResponse } from '@/types/generateResponse.ts'

export const description =
  'Web worker proof of concept - test generator execution in isolated worker'

type GenerateWithWorkerArgs = {
  schemaContents: string
  /**
   * File type of the schema source. `json`/`yaml` route through the
   * OpenAPI converter; `graphql` is sent as raw SDL — the worker calls
   * the GraphQL parser internally.
   */
  clientSettings: ClientSettings | undefined
  bundlePath: string
  /**
   * Optional gen-maps (attribution) emission config. When a `postPass`
   * block is present, the worker emits sidecars + a generation map
   * alongside artifacts. Caller writes them to disk. (Capture is always
   * on in core; this only controls emission.)
   */
  attribution?: SerializableAttribution
}

export const generateWithWorker = ({
  schemaContents,
  clientSettings,
  bundlePath,
  attribution
}: GenerateWithWorkerArgs): Promise<GenerateResponse> => {
  const workerUrl = new URL(bundlePath, import.meta.url)

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
    worker.onmessage = async (e: MessageEvent) => {
      const { type } = e.data

      switch (type) {
        case 'READY': {
          const document = await toDocumentInput(schemaContents)
          worker.postMessage({
            type: 'GENERATE',
            payload: {
              document,
              clientSettings,
              attribution
            }
          })
          break
        }

        case 'RESULT': {
          worker.terminate()
          const { artifacts, manifest, sidecars, generationMap } = e.data
          resolve({ artifacts, manifest, sidecars, generationMap })
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

    worker.onerror = error => {
      console.error('❌ Worker error:', error)

      reject(error)
    }
  })
}
