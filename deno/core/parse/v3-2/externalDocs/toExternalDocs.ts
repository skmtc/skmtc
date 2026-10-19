import { OasExternalDocs } from '@/oas/externalDocs/ExternalDocs.ts'
import * as v from 'valibot'
import { oasExternalDocsData } from '@/oas/externalDocs/externalDocsTypes.ts'
import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContextType } from '@/context/parseTypes.ts'
import type { StackTrail } from '@/context/StackTrail.ts'

export type ToExternalDocsArgs = {
  externalDocs: OpenAPIV3.ExternalDocumentationObject | undefined
  stackTrail: StackTrail
  context: ParseContextType
}

export const toExternalDocs = ({
  externalDocs,
  stackTrail
}: ToExternalDocsArgs): OasExternalDocs | undefined => {
  if (!externalDocs) {
    return undefined
  }

  if (!v.is(oasExternalDocsData, externalDocs)) {
    v.parse(oasExternalDocsData, externalDocs)
  }

  return new OasExternalDocs({
    url: externalDocs.url,
    description: externalDocs.description
  })
}
