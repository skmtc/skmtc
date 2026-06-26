import { stringToSchema, toV3Document } from '@skmtc/convert'
import type { SkmtcDocumentInput } from '@skmtc/core'
import { fileTypeToProtocol, type FileType } from '@/lib/types.ts'

/**
 * Build the host-side `SkmtcDocumentInput` for a worker run (generate or
 * describe).
 *
 * - For OAS (JSON / YAML) sources we run the host-side `@skmtc/convert`
 *   to normalize Swagger 2 / OAS 3.1 → 3.0. The resulting
 *   `OpenAPIV3.Document` is JSON-clone-safe so it crosses the worker
 *   boundary without surprises.
 * - For GraphQL we post the raw SDL string. A pre-parsed `GqlDocument`
 *   would carry class instances and `OasRef` back-refs that don't
 *   survive structured clone, so SDL parsing happens inside the worker.
 *
 * Switch is exhaustive over `Protocol`; adding a new protocol forces a
 * compile error here.
 */
export const toDocumentInput = async (
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
