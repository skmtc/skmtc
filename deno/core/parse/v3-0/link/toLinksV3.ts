import { toRefV31 } from '../ref/toRefV31.ts'
import { toServerV3 } from '../server/toServerV3.ts'
import type { ParseContextType } from '@/context/parseTypes.ts'
import { isRef } from '@/helpers/refFns.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { OasLink } from '@/oas/link/Link.ts'
import type { LinkFields } from '@/oas/link/Link.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import type { StackTrail } from '@/context/StackTrail.ts'

export type ToLinksV3Args = {
  links: Record<string, OpenAPIV3.ReferenceObject | OpenAPIV3.LinkObject> | undefined
  stackTrail: StackTrail
  context: ParseContextType
}

export const toLinksV3 = ({
  links,
  stackTrail,
  context
}: ToLinksV3Args): Record<string, OasLink | OasRef<'link'>> | undefined => {
  if (!links) {
    return undefined
  }

  const output: Record<string, OasLink | OasRef<'link'>> = {}

  for (const [key, value] of Object.entries(links)) {
    output[key] = stackTrail.trace(key, st => toLinkV3({ link: value, stackTrail: st, context }))
  }

  return output
}

export type ToLinkV3Args = {
  link: OpenAPIV3.ReferenceObject | OpenAPIV3.LinkObject
  stackTrail: StackTrail
  context: ParseContextType
}

const toLinkV3 = ({ link, stackTrail, context }: ToLinkV3Args): OasLink | OasRef<'link'> => {
  if (isRef(link)) {
    return toRefV31({ ref: link, refType: 'link', stackTrail, context })
  }

  const { operationRef, operationId, parameters, requestBody, description, server, ...skipped } =
    link

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    parent: link,
    context,
    stackTrail,
    parentType: 'link'
  })

  const fields: LinkFields = {
    operationRef,
    operationId,
    parameters,
    requestBody,
    description,
    server:
      server !== undefined
        ? stackTrail.trace('server', st => toServerV3({ server, stackTrail: st, context }))
        : undefined,
    extensionFields
  }

  return new OasLink(fields)
}
