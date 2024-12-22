import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContext } from '../../context/ParseContext.js'
import { OasBoolean } from './Boolean.js'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.js'

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
