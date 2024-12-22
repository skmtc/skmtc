import type { OpenAPIV3 } from 'npm:openapi-types@12.1.3'
import type { ParseContext } from '../../context/ParseContext.ts'
import { OasBoolean } from './Boolean.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'

type ToBooleanArgs = {
  value: OpenAPIV3.NonArraySchemaObject
  context: ParseContext
}

export const toBoolean = ({ value, context }: ToBooleanArgs): OasBoolean => {
  const { type: _type, title, description, nullable, example, ...skipped } = value

  const extensionFields = toSpecificationExtensionsV3({ skipped, context })

  return new OasBoolean({
    nullable,
    title,
    description,
    example,
    extensionFields
  })
}
