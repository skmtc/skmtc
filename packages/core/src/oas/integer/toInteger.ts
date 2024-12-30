import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContext } from '../../context/ParseContext.js'
import { OasInteger } from './Integer.js'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.js'
import { oasIntegerData } from './integer-types.js'

type ToIntegerArgs = {
  value: OpenAPIV3.NonArraySchemaObject
  context: ParseContext
}

export const toInteger = ({ value, context }: ToIntegerArgs): OasInteger => {
  const {
    type: _type,
    title,
    description,
    nullable,
    format,
    enum: enums,
    example,
    ...skipped
  } = oasIntegerData.parse(value)

  const extensionFields = toSpecificationExtensionsV3({ skipped, context })

  return new OasInteger({
    title,
    description,
    nullable,
    format,
    enums,
    extensionFields,
    example
  })
}
