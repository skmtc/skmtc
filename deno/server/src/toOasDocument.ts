import { CoreContext } from '@skmtc/core'
import type { OpenAPIV3 } from 'openapi-types'
type ToOasDocumentArgs = {
  documentObject: OpenAPIV3.Document
  spanId: string
}

export const toOasDocument = ({ documentObject, spanId }: ToOasDocumentArgs) => {
  const context = new CoreContext({ spanId })

  return context.parse(documentObject)
}
