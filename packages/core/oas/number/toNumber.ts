import type { OpenAPIV3 } from 'npm:openapi-types@12.1.3'
import type { ParseContext } from '../../context/ParseContext.ts'
import { OasNumber } from './Number.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'

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
