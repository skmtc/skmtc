import { toRefV31 } from '../ref/toRefV31.js'
import { toHeadersV3 } from '../header/toHeadersV3.js'
import type { ParseContext } from '../../context/ParseContext.js'
import { isRef } from '../../helpers/refFns.js'
import type { OpenAPIV3 } from 'openapi-types'
import { toOptionalMediaTypeItemsV3 } from '../mediaType/toMediaTypeItemV3.js'
import { OasResponse } from './Response.js'
import type { ResponseFields } from './Response.js'
import type { OasRef } from '../ref/Ref.js'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.js'

type ToResponsesV3Args = {
  responses: OpenAPIV3.ResponsesObject
  context: ParseContext
}

export const toResponsesV3 = ({
  responses,
  context
}: ToResponsesV3Args): Record<string, OasResponse | OasRef<'response'>> => {
  return Object.fromEntries(
    Object.entries(responses).map(([key, value]) => {
      return [key, context.trace(key, () => toResponseV3({ response: value, context }))]
    })
  )
}

type ToOptionalResponsesV3Args = {
  responses: OpenAPIV3.ResponsesObject | undefined
  context: ParseContext
}

export const toOptionalResponsesV3 = ({
  responses,
  context
}: ToOptionalResponsesV3Args): Record<string, OasResponse | OasRef<'response'>> | undefined => {
  if (!responses) {
    return undefined
  }

  return toResponsesV3({ responses, context })
}

type ToResponseV3Args = {
  response: OpenAPIV3.ReferenceObject | OpenAPIV3.ResponseObject
  context: ParseContext
}

export const toResponseV3 = ({
  response,
  context
}: ToResponseV3Args): OasResponse | OasRef<'response'> => {
  if (isRef(response)) {
    return toRefV31({ ref: response, refType: 'response', context })
  }

  const { description, headers, content, ...skipped } = response

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    context
  })

  const fields: ResponseFields = {
    description,
    headers: context.trace('headers', () => toHeadersV3({ headers, context })),
    content: context.trace('content', () => toOptionalMediaTypeItemsV3({ content, context })),
    extensionFields
  }

  return new OasResponse(fields)
}
