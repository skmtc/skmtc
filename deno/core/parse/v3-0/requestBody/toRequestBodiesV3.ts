import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContextType } from '@/context/parseTypes.ts'
import { isRef } from '@/helpers/refFns.ts'
import { toRefV31 } from '../ref/toRefV31.ts'
import { toMediaTypeItemsV3 } from '../mediaType/toMediaTypeItemV3.ts'
import { OasRequestBody } from '@/oas/requestBody/RequestBody.ts'
import type { RequestBodyFields } from '@/oas/requestBody/RequestBody.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import type { StackTrail } from '@/context/StackTrail.ts'
import { logBodyMediaTypes } from '@/parse/logBodyMediaTypes.ts'
import { toComponentEntries } from '@/parse/toComponentEntries.ts'
export type ToRequestBodyV3Args = {
  requestBody: OpenAPIV3.ReferenceObject | OpenAPIV3.RequestBodyObject | undefined
  forceRef?: boolean
  stackTrail: StackTrail
  context: ParseContextType
}

export const toRequestBodyV3 = ({
  requestBody,
  stackTrail,
  context
}: ToRequestBodyV3Args): OasRequestBody | OasRef<'requestBody'> | undefined => {
  if (!requestBody) {
    return undefined
  }

  if (isRef(requestBody)) {
    return toRefV31({ ref: requestBody, refType: 'requestBody', stackTrail, context })
  }

  const { description, content, required, ...skipped } = requestBody

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    parent: requestBody,
    context,
    stackTrail,
    parentType: 'requestBody'
  })

  const fields: RequestBodyFields = {
    description,
    content: stackTrail.trace('content', st => {
      return toMediaTypeItemsV3({ content, stackTrail: st, context })
    }),
    required,
    extensionFields
  }

  const parsed = context.withStackTrail(stackTrail, () => new OasRequestBody(fields, context))

  logBodyMediaTypes({ content: fields.content, stackTrail, context })

  return parsed
}

export type ToRequestBodiesV3Args = {
  requestBodies: Record<string, OpenAPIV3.ReferenceObject | OpenAPIV3.RequestBodyObject> | undefined
  stackTrail: StackTrail
  context: ParseContextType
}

export const toRequestBodiesV3 = ({
  requestBodies,
  stackTrail,
  context
}: ToRequestBodiesV3Args): Record<string, OasRequestBody | OasRef<'requestBody'>> | undefined => {
  if (!requestBodies) {
    return undefined
  }

  return toComponentEntries({
    entries: requestBodies,
    stackTrail,
    context,
    type: 'INVALID_REQUEST_BODY',
    label: 'Request body',
    parse: ({ entry, stackTrail: st }) =>
      toRequestBodyV3({ requestBody: entry, stackTrail: st, context })
  })
}
