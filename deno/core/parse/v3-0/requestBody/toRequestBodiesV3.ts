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
import { assertEntryObject } from '@/parse/assertEntryObject.ts'
import { tryParseAt } from '@/context/tryParseAt.ts'
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

  // Each entry parses inside its own boundary: a broken one is dropped with
  // an INVALID_REQUEST_BODY error, and the others are kept.
  const entries = Object.entries(requestBodies).flatMap(
    ([key, requestBody]): [string, OasRequestBody | OasRef<'requestBody'>][] => {
      const parsed = tryParseAt({
        stackTrail,
        key,
        context,
        type: 'INVALID_REQUEST_BODY',
        parent: requestBody,
        fn: st => {
          assertEntryObject({ value: requestBody, label: 'Request body' })
          return toRequestBodyV3({ requestBody, stackTrail: st, context })
        }
      })

      return parsed ? [[key, parsed]] : []
    }
  )

  return Object.fromEntries(entries)
}
