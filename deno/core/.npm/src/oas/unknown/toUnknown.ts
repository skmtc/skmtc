import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContext } from '../../context/ParseContext.js'
import { OasUnknown } from './Unknown.js'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.js'

type ToUnknownArgs = {
  value: OpenAPIV3.NonArraySchemaObject

  context: ParseContext
}

export const toUnknown = ({ value, context }: ToUnknownArgs): OasUnknown => {
  const { type: _type, title, description, example, ...skipped } = value

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    context
  })

  return new OasUnknown({
    title,
    description,
    extensionFields,
    example
  })
}
