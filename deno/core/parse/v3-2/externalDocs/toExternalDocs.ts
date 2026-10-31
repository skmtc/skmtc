import { OasExternalDocs } from '@/oas/externalDocs/ExternalDocs.ts'
import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContextType } from '@/context/parseTypes.ts'
import type { StackTrail } from '@/context/StackTrail.ts'
import { toValidExternalDocs } from '@/parse/descriptiveFields.ts'

export type ToExternalDocsArgs = {
  externalDocs: OpenAPIV3.ExternalDocumentationObject | undefined
  /** Trail that ends in the `externalDocs` key. */
  stackTrail: StackTrail
  context: ParseContextType
}

/** An invalid `externalDocs` is left out with a warning; its parent is kept. */
export const toExternalDocs = ({
  externalDocs,
  stackTrail,
  context
}: ToExternalDocsArgs): OasExternalDocs | undefined => {
  if (externalDocs === undefined) {
    return undefined
  }

  const valid = toValidExternalDocs({ externalDocs, stackTrail, context })

  if (!valid) {
    return undefined
  }

  return new OasExternalDocs({
    url: valid.url,
    description: valid.description
  })
}
