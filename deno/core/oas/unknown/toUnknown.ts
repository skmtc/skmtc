import type { OpenAPIV3 } from 'npm:openapi-types@12.1.3'
import type { ParseContext } from '../../context/ParseContext.ts'
import { OasUnknown } from './Unknown.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'

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
