import type { OpenAPIV3 } from 'npm:openapi-types@12.1.3'
import type { ParseContext } from '../../context/ParseContext.ts'
import { toParameterListV3 } from '../parameter/toParameterV3.ts'
import { OasPathItem } from './PathItem.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'

type ToPathItemV3Args = {
  pathItem: OpenAPIV3.PathItemObject
  context: ParseContext
}

export const toPathItemV3 = ({ pathItem, context }: ToPathItemV3Args): OasPathItem => {
  const { summary, description, parameters, ...skipped } = pathItem

  return new OasPathItem({
    summary,
    description,
    parameters: context.trace('parameters', () => toParameterListV3({ parameters, context })),
    extensionFields: toSpecificationExtensionsV3({ skipped, context })
  })
}
