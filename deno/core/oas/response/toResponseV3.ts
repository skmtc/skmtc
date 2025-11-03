import { toRefV31 } from '../ref/toRefV31.ts'
import { toHeadersV3 } from '../header/toHeadersV3.ts'
import type { ParseContextType } from '@/context/parseTypes.ts'
import { isRef } from '../../helpers/refFns.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toOptionalMediaTypeItemsV3 } from '../mediaType/toMediaTypeItemV3.ts'
import { OasResponse } from './Response.ts'
import type { OasRef } from '../ref/Ref.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import invariant from 'tiny-invariant'
import { tracer } from '@/helpers/tracer.ts'
type ToResponsesV3Args = {
  responses: OpenAPIV3.ResponsesObject
  context: ParseContextType
}

export const toResponsesV3 = ({
  responses,
  context
}: ToResponsesV3Args): Record<string, OasResponse | OasRef<'response'>> => {
  const output: Record<string, OasResponse | OasRef<'response'>> = {}
  const entries = Object.entries(responses)

  for (const [key, value] of entries) {
    try {
      output[key] = tracer(context.stackTrail, key, () =>
        toResponseV3({ response: value, context })
      )
    } catch (error) {
      invariant(error instanceof Error, 'Invalid error')

      context.logIssue({
        key,
        level: 'error',
        error,
        parent: value,
        type: 'INVALID_RESPONSE'
      })
    }
  }
  return output
}

type ToOptionalResponsesV3Args = {
  responses: OpenAPIV3.ResponsesObject | undefined
  context: ParseContextType
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
  context: ParseContextType
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

  return new OasResponse({
    description,
    headers: tracer(context.stackTrail, 'headers', () => toHeadersV3({ headers, context })),
    content: tracer(context.stackTrail, 'content', () =>
      toOptionalMediaTypeItemsV3({ content, context })
    ),
    extensionFields
  })
}
