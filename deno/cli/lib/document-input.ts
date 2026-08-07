import { inferProtocol, stringToSchema, toV3Document } from '@skmtc/convert'
import type { SkmtcDocumentInput } from '@skmtc/core'

/**
 * Build the host-side `SkmtcDocumentInput` for a worker run (generate or
 * describe).
 *
 * The protocol is read from the DOCUMENT, not from where it came from.
 * A file extension, a URL and a `Content-Type` are all names given by
 * whoever served it, and an extensionless endpoint carries no name at
 * all; the bytes are already in hand and cannot contradict themselves.
 * `@skmtc/convert` owns the inference so the stack server reaches the
 * same verdict for the same document.
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
export const toDocumentInput = async (schemaContents: string): Promise<SkmtcDocumentInput> => {
  const protocol = inferProtocol(schemaContents)
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
