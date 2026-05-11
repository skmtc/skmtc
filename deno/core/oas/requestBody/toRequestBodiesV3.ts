import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContextType } from '@/context/parseTypes.ts'
import { isRef } from '../../helpers/refFns.ts'
import { toRefV31 } from '../ref/toRefV31.ts'
import { toMediaTypeItemsV3 } from '../mediaType/toMediaTypeItemV3.ts'
import { OasRequestBody } from './RequestBody.ts'
import type { RequestBodyFields } from './RequestBody.ts'
import type { OasRef } from '../ref/Ref.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import type { StackTrail } from '@/context/StackTrail.ts'
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

  return new OasRequestBody(fields)
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

  const entries = Object.entries(requestBodies)
    .map(([key, value]) => {
      return [
        key,
        stackTrail.trace(key, st =>
          toRequestBodyV3({ requestBody: value, stackTrail: st, context })
        )
      ]
    })
    .filter(([, value]) => Boolean(value))

  return Object.fromEntries(entries)
}
