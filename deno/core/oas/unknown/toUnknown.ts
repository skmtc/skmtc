import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContext } from '../../context/ParseContext.ts'
import { OasUnknown } from './Unknown.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'

type ToUnknownArgs = {
  value: OpenAPIV3.SchemaObject

  context: ParseContext
}

export const toUnknown = ({ value, context }: ToUnknownArgs): OasUnknown => {
  const { type: _type, title, description, example, ...skipped } = value

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    parent: value,
    context,
    parentType: 'schema:unknown'
  })

  return new OasUnknown({
    title,
    description,
    extensionFields,
    example
  })
}
