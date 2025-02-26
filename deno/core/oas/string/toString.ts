import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContext } from '../../context/ParseContext.ts'
import { OasString } from './String.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import { oasStringData, stringFormat } from './string-types.ts'

type ToStringArgs = {
  value: OpenAPIV3.NonArraySchemaObject
  context: ParseContext
}

export const toString = ({ value, context }: ToStringArgs): OasString => {
  const {
    type: _type,
    title,
    description,
    enum: enums,
    nullable,
    example,
    format,
    maxLength,
    minLength,
    ...skipped
  } = oasStringData.parse(value)

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    context
  })

  if (format && !stringFormat.safeParse(format).success) {
    context.logger.warn(`Invalid format: ${format}`)
  }

  return new OasString({
    title,
    description,
    enums,
    nullable,
    example,
    format,
    maxLength,
    minLength,
    extensionFields
  })
}
