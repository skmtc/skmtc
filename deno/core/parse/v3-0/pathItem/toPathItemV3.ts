import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContextType } from '@/context/parseTypes.ts'
import { toParameterListV3 } from '../parameter/toParameterV3.ts'
import { OasPathItem } from '@/oas/pathItem/PathItem.ts'
import { toOptionalServersV3 } from '@/parse/v3-0/server/toServerV3.ts'
import { tryParseAt } from '@/context/tryParseAt.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import type { StackTrail } from '@/context/StackTrail.ts'
export type ToPathItemV3Args = {
  pathItem: OpenAPIV3.PathItemObject
  stackTrail: StackTrail
  context: ParseContextType
}

export const toPathItemV3 = ({ pathItem, stackTrail, context }: ToPathItemV3Args): OasPathItem => {
  const { summary, description, parameters, servers, ...skipped } = pathItem

  return new OasPathItem({
    summary,
    description,
    parameters: stackTrail.trace('parameters', st =>
      toParameterListV3({ parameters, stackTrail: st, context })
    ),
    servers: tryParseAt({
      stackTrail,
      key: 'servers',
      context,
      type: 'INVALID_OPERATION',
      parent: pathItem,
      fn: st => toOptionalServersV3({ servers, stackTrail: st, context })
    }),
    extensionFields: toSpecificationExtensionsV3({
      skipped,
      parent: pathItem,
      context,
      stackTrail,
      parentType: 'pathItem'
    })
  })
}
