import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContext } from '../../context/ParseContext.js'
import { OasNumber } from './Number.js'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.js'

type ToNumberArgs = {
  value: OpenAPIV3.NonArraySchemaObject
  context: ParseContext
}

export const toNumber = ({ value, context }: ToNumberArgs): OasNumber => {
  const { type: _type, title, description, nullable, example, ...skipped } = value

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    context
  })

  return new OasNumber({
    title,
    description,
    nullable,
    extensionFields,
    example
  })
}
