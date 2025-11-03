import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContextType } from '@/context/parseTypes.ts'
import { toParameterListV3 } from '../parameter/toParameterV3.ts'
import { OasPathItem } from './PathItem.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import { tracer } from '@/helpers/tracer.ts'
type ToPathItemV3Args = {
  pathItem: OpenAPIV3.PathItemObject
  context: ParseContextType
}

export const toPathItemV3 = ({ pathItem, context }: ToPathItemV3Args): OasPathItem => {
  const { summary, description, parameters, ...skipped } = pathItem

  return new OasPathItem({
    summary,
    description,
    parameters: tracer(context.stackTrail, 'parameters', () =>
      toParameterListV3({ parameters, context })
    ),
    extensionFields: toSpecificationExtensionsV3({
      skipped,
      parent: pathItem,
      context,
      parentType: 'pathItem'
    })
  })
}
