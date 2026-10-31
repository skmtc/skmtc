import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContextType } from '@/context/parseTypes.ts'
import { toPathParameterListV3 } from '@/parse/v3-0/parameter/toParameterV3.ts'
import type { BrokenPathParameter } from '@/parse/pathParameters.ts'
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

export type PathItemV3 = {
  pathItem: OasPathItem
  /** Path-level parameters that failed to parse; the caller drops each operation they apply to. */
  brokenParameters: BrokenPathParameter[]
}

export const toPathItemV3 = ({ pathItem, stackTrail, context }: ToPathItemV3Args): PathItemV3 => {
  const { summary, description, parameters, servers, ...skipped } = pathItem

  const pathParameters = stackTrail.trace('parameters', st =>
    toPathParameterListV3({ parameters, stackTrail: st, context })
  )

  const oasPathItem = new OasPathItem({
    summary,
    description,
    parameters: pathParameters.parameters,
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

  return { pathItem: oasPathItem, brokenParameters: pathParameters.broken }
}
