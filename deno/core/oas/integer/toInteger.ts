import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContext } from '../../context/ParseContext.ts'
import { OasInteger } from './Integer.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import { oasIntegerData } from './integer-types.ts'
import * as v from 'valibot'
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
  } = v.parse(oasIntegerData, value)

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
