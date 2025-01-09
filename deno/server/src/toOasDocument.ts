import { CoreContext, type ParseReturn } from '@skmtc/core'

type ToOasDocumentArgs = {
  schema: string
  spanId: string
}

export const toOasDocument = ({ schema, spanId }: ToOasDocumentArgs): ParseReturn => {
  const context = new CoreContext({ spanId })

  return context.parse(schema)
}
