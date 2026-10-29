import { toRefV31 } from '../ref/toRefV31.ts'
import { toHeadersV3 } from '../header/toHeadersV3.ts'
import { toLinksV3 } from '../link/toLinksV3.ts'
import type { ParseContextType } from '@/context/parseTypes.ts'
import { isRef } from '@/helpers/refFns.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toOptionalMediaTypeItemsV3 } from '../mediaType/toMediaTypeItemV3.ts'
import { OasResponse } from '@/oas/response/Response.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import { tryParseAt } from '@/context/tryParseAt.ts'
import type { StackTrail } from '@/context/StackTrail.ts'
import { logBodyMediaTypes } from '@/parse/logBodyMediaTypes.ts'

/** A 3.2 Response Object: the 3.0 shape plus `summary`. */
export type ResponseObjectV32 = OpenAPIV3.ResponseObject & { summary?: string }

/** A 3.2 Responses Object: status code to a 3.2 Response Object or a reference. */
export type ResponsesObjectV32 = Record<string, OpenAPIV3.ReferenceObject | ResponseObjectV32>

export type ToResponsesV3Args = {
  responses: ResponsesObjectV32
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
    const parsed = tryParseAt({
      stackTrail,
      key,
      context,
      type: 'INVALID_RESPONSE',
      parent: value,
      fn: st => toResponseV3({ response: value, stackTrail: st, context })
    })
    if (parsed !== undefined) {
      output[key] = parsed
    }
  }
  return output
}

export type ToOptionalResponsesV3Args = {
  responses: ResponsesObjectV32 | undefined
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

export type ToResponseV3Args = {
  response: OpenAPIV3.ReferenceObject | ResponseObjectV32
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

  const { summary, description, headers, links, content, ...skipped } = response

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    parent: response,
    context,
    stackTrail,
    parentType: 'response'
  })

  const parsedHeaders = stackTrail.trace('headers', st =>
    toHeadersV3({ headers, stackTrail: st, context })
  )
  const parsedLinks = stackTrail.trace('links', st => toLinksV3({ links, stackTrail: st, context }))
  const parsedContent = stackTrail.trace('content', st =>
    toOptionalMediaTypeItemsV3({ content, stackTrail: st, context })
  )

  const parsed = context.withStackTrail(
    stackTrail,
    () =>
      new OasResponse(
        {
          summary,
          description,
          headers: parsedHeaders,
          links: parsedLinks,
          content: parsedContent,
          extensionFields
        },
        context
      )
  )

  logBodyMediaTypes({ content: parsedContent, stackTrail, context })

  return parsed
}
