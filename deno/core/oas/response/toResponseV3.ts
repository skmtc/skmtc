import { toRefV31 } from '../ref/toRefV31.ts'
import { toHeadersV3 } from '../header/toHeadersV3.ts'
import type { ParseContext } from '../../context/ParseContext.ts'
import { isRef } from '../../helpers/refFns.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toOptionalMediaTypeItemsV3 } from '../mediaType/toMediaTypeItemV3.ts'
import { OasResponse } from './Response.ts'
import type { ResponseFields } from './Response.ts'
import type { OasRef } from '../ref/Ref.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import invariant from 'tiny-invariant'
type ToResponsesV3Args = {
  responses: OpenAPIV3.ResponsesObject
  context: ParseContext
}

export const toResponsesV3 = ({
  responses,
  context
}: ToResponsesV3Args): Record<string, OasResponse | OasRef<'response'>> => {
  return Object.fromEntries(
    Object.entries(responses)
      .map(([key, value]) => {
        try {
          return [key, context.trace(key, () => toResponseV3({ response: value, context }))]
        } catch (error) {
          invariant(error instanceof Error, 'Invalid error')

          context.logIssue({
            key,
            level: 'error',
            error,
            parent: value,
            type: 'INVALID_RESPONSE'
          })

          return undefined
        }
      })
      .filter(item => item !== undefined)
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
    parent: response,
    context,
    parentType: 'response'
  })

  const fields: ResponseFields = {
    description,
    headers: context.trace('headers', () => toHeadersV3({ headers, context })),
    content: context.trace('content', () => toOptionalMediaTypeItemsV3({ content, context })),
    extensionFields
  }

  return new OasResponse(fields)
}
