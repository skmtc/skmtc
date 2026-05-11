import { toV3Document, stringToSchema } from '@skmtc/convert'
import type { ClientSettings } from '@skmtc/core/Settings'
import type { SkmtcDocumentInput } from '@skmtc/core'
import { fileTypeToProtocol, type FileType } from '@/lib/types.ts'
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
  fileType: FileType
  clientSettings: ClientSettings | undefined
  bundlePath: string
}

/**
 * Build the host-side `SkmtcDocumentInput` for a generate run.
 *
 * - For OAS (JSON / YAML) sources we run the host-side
 *   `@skmtc/convert` to normalise Swagger 2 / OAS 3.1 → 3.0. The
 *   resulting `OpenAPIV3.Document` is JSON-clone-safe so it crosses the
 *   worker boundary without surprises.
 * - For GraphQL we post the raw SDL string. A pre-parsed `GqlDocument`
 *   would carry class instances and `OasRef` back-refs that don't
 *   survive structured clone, so SDL parsing happens inside the worker
 *   via `toArtifacts` (now protocol-agnostic).
 *
 * Switch is exhaustive over `Protocol`; adding a new protocol forces a
 * compile error here.
 */
const toDocumentInput = async (
  schemaContents: string,
  fileType: FileType
): Promise<SkmtcDocumentInput> => {
  const protocol = fileTypeToProtocol(fileType)
  switch (protocol) {
    case 'gql': {
      return { type: 'gql', value: schemaContents }
    }
    case 'oas': {
      const documentObject = await toV3Document(stringToSchema(schemaContents))
      return { type: 'oas', value: documentObject }
    }
    default: {
      const _exhaustive: never = protocol
      throw new Error(`Unhandled protocol: ${_exhaustive}`)
    }
  }
}

export const generateWithWorker = ({
  schemaContents,
  fileType,
  clientSettings,
  bundlePath
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
          const document = await toDocumentInput(schemaContents, fileType)
          worker.postMessage({
            type: 'GENERATE',
            payload: {
              document,
              clientSettings
            }
          })
          break
        }

        case 'RESULT': {
          worker.terminate()
          const { artifacts, manifest } = e.data
          resolve({ artifacts, manifest })
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
