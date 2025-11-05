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
import type { StackTrail } from '@/context/StackTrail.ts'

type ToResponsesV3Args = {
  responses: OpenAPIV3.ResponsesObject
  stackTrail: StackTrail
  context: ParseContextType
}

export const toResponsesV3 = ({
  responses,
  stackTrail,
  context
}: ToResponsesV3Args): Record<string, OasResponse | OasRef<'response'>> => {
  const output: Record<string, OasResponse | OasRef<'response'>> = {}
  const entries = Object.entries(responses)

  for (const [key, value] of entries) {
    try {
      output[key] = stackTrail.trace(key, st =>
        toResponseV3({ response: value, stackTrail: st, context })
      )
    } catch (error) {
      invariant(error instanceof Error, 'Invalid error')

      context.logIssue({
        key,
        level: 'error',
        error,
        parent: value,
        stackTrail,
        type: 'INVALID_RESPONSE'
      })
    }
  }
  return output
}

type ToOptionalResponsesV3Args = {
  responses: OpenAPIV3.ResponsesObject | undefined
  stackTrail: StackTrail
  context: ParseContextType
}

export const toOptionalResponsesV3 = ({
  responses,
  stackTrail,
  context
}: ToOptionalResponsesV3Args): Record<string, OasResponse | OasRef<'response'>> | undefined => {
  if (!responses) {
    return undefined
  }

  return toResponsesV3({ responses, stackTrail, context })
}

type ToResponseV3Args = {
  response: OpenAPIV3.ReferenceObject | OpenAPIV3.ResponseObject
  stackTrail: StackTrail
  context: ParseContextType
}

export const toResponseV3 = ({
  response,
  stackTrail,
  context
}: ToResponseV3Args): OasResponse | OasRef<'response'> => {
  if (isRef(response)) {
    return toRefV31({ ref: response, refType: 'response', stackTrail, context })
  }

  const { description, headers, content, ...skipped } = response

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    parent: response,
    context,
    stackTrail,
    parentType: 'response'
  })

  return new OasResponse({
    description,
    headers: stackTrail.trace('headers', st => toHeadersV3({ headers, stackTrail: st, context })),
    content: stackTrail.trace('content', st =>
      toOptionalMediaTypeItemsV3({ content, stackTrail: st, context })
    ),
    extensionFields
  })
}
