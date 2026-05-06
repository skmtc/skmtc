import { toV3Document, stringToSchema } from '@skmtc/convert'
import type { ClientSettings } from '@skmtc/core/Settings'
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

  const protocol = fileTypeToProtocol(fileType)

  return new Promise((resolve, reject) => {
    // Set up message handler
    worker.onmessage = async (e: MessageEvent) => {
      const { type } = e.data

      switch (type) {
        case 'READY': {
          // Build the appropriate worker payload by discriminating on
          // the source kind:
          //   - 'oas': convert to OpenAPI v3 document object here on
          //     the host so the worker receives a JSON-serialisable
          //     structure (the conversion involves Swagger 2 / OAS 3.1
          //     → 3.0 normalisation that's fine to do on the host).
          //   - 'gql': post the raw SDL string. `GqlDocument` instances
          //     hold class instances and OasRef back-refs that don't
          //     survive structured clone, so parsing must happen inside
          //     the worker via `toArtifactsFromGraphQL`.
          // Switch is exhaustive over `Protocol`; adding a new
          // protocol forces a compile error here.
          switch (protocol) {
            case 'gql': {
              worker.postMessage({
                type: 'GENERATE',
                payload: {
                  protocol: 'gql',
                  gqlSource: schemaContents,
                  clientSettings
                }
              })
              break
            }
            case 'oas': {
              const documentObject = await toV3Document(stringToSchema(schemaContents))
              worker.postMessage({
                type: 'GENERATE',
                payload: {
                  protocol: 'oas',
                  documentObject,
                  clientSettings
                }
              })
              break
            }
            default: {
              const _exhaustive: never = protocol
              throw new Error(`Unhandled protocol: ${_exhaustive}`)
            }
          }
          break
        }

        case 'RESULT': {
          // Cleanup
          worker.terminate()
          // The wire payload is `{ type, artifacts, manifest, parseIssues }`.
          // Default `parseIssues` to an empty array so older worker
          // bundles (built before issue tracking landed) don't blow up
          // the host-side type contract.
          const { artifacts, manifest, parseIssues = [] } = e.data
          resolve({ artifacts, manifest, parseIssues })
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
