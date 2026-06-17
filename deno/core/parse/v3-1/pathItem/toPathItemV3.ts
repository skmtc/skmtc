import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContextType } from '@/context/parseTypes.ts'
import { toParameterListV3 } from '../parameter/toParameterV3.ts'
import { OasPathItem } from '@/oas/pathItem/PathItem.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import type { StackTrail } from '@/context/StackTrail.ts'
export type ToPathItemV3Args = {
  pathItem: OpenAPIV3.PathItemObject
  stackTrail: StackTrail
  context: ParseContextType
}

export const toPathItemV3 = ({ pathItem, stackTrail, context }: ToPathItemV3Args): OasPathItem => {
  const { summary, description, parameters, ...skipped } = pathItem

  return new OasPathItem({
    summary,
    description,
    parameters: stackTrail.trace('parameters', st =>
      toParameterListV3({ parameters, stackTrail: st, context })
    ),
    extensionFields: toSpecificationExtensionsV3({
      skipped,
      parent: pathItem,
      context,
      stackTrail,
      parentType: 'pathItem'
    })
  })
}
