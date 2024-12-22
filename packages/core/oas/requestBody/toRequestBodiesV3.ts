import type { OpenAPIV3 } from 'npm:openapi-types@12.1.3'
import type { ParseContext } from '../../context/ParseContext.ts'
import { isRef } from '../../helpers/refFns.ts'
import { toRefV31 } from '../ref/toRefV31.ts'
import { toMediaTypeItemsV3 } from '../mediaType/toMediaTypeItemV3.ts'
import { OasRequestBody } from './RequestBody.ts'
import type { RequestBodyFields } from './RequestBody.ts'
import type { OasRef } from '../ref/Ref.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'

type ToRequestBodyV3Args = {
  requestBody: OpenAPIV3.ReferenceObject | OpenAPIV3.RequestBodyObject | undefined
  forceRef?: boolean
  context: ParseContext
}

export const toRequestBodyV3 = ({
  requestBody,
  context
}: ToRequestBodyV3Args): OasRequestBody | OasRef<'requestBody'> | undefined => {
  if (!requestBody) {
    return undefined
  }

  if (isRef(requestBody)) {
    return toRefV31({ ref: requestBody, refType: 'requestBody', context })
  }

  const { description, content, required, ...skipped } = requestBody

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    context
  })

  const fields: RequestBodyFields = {
    description,
    content: context.trace('content', () => {
      return toMediaTypeItemsV3({ content, context })
    }),
    required,
    extensionFields
  }

  return new OasRequestBody(fields)
}

type ToRequestBodiesV3Args = {
  requestBodies: Record<string, OpenAPIV3.ReferenceObject | OpenAPIV3.RequestBodyObject> | undefined
  context: ParseContext
}

export const toRequestBodiesV3 = ({
  requestBodies,
  context
}: ToRequestBodiesV3Args): Record<string, OasRequestBody | OasRef<'requestBody'>> | undefined => {
  if (!requestBodies) {
    return undefined
  }

  const entries = Object.entries(requestBodies)
    .map(([key, value]) => {
      return [key, context.trace(key, () => toRequestBodyV3({ requestBody: value, context }))]
    })
    .filter(([, value]) => Boolean(value))

  return Object.fromEntries(entries)
}
