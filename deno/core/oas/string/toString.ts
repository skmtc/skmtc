import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContext } from '../../context/ParseContext.ts'
import { OasString } from './String.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import { oasStringData, stringFormat } from './string-types.ts'
import * as v from 'valibot'
import { parseNullable } from '../_helpers/parseNullable.ts'
import { parseExample } from '../_helpers/parseExample.ts'
import { parseEnum } from '../_helpers/parseEnum.ts'

type ToStringArgs = {
  value: OpenAPIV3.SchemaObject
  context: ParseContext
}

export const toString = ({ context, value }: ToStringArgs) => {
  const { nullable, value: valueWithoutNullable } = parseNullable({
    value,
    context
  })

  const { example, value: valueWithoutExample } = parseExample({
    value: valueWithoutNullable,
    nullable,
    valibotSchema: v.string(),
    context
  })

  const { enum: enums, value: valueWithoutEnums } = parseEnum({
    value: valueWithoutExample,
    nullable,
    valibotSchema: v.string(),
    context
  })

  return toParsedString({
    context,
    nullable,
    example,
    enums,
    value: valueWithoutEnums
  })
}

type ToParsedStringArgs<Nullable extends boolean | undefined> = {
  value: Omit<OpenAPIV3.SchemaObject, 'nullable' | 'example' | 'enums'>
  context: ParseContext
  nullable: Nullable
  example: Nullable extends true ? string | null | undefined : string | undefined
  enums: Nullable extends true ? (string | null)[] | undefined : string[] | undefined
}

export const toParsedString = <Nullable extends boolean | undefined>({
  context,
  nullable,
  example,
  enums,
  value
}: ToParsedStringArgs<Nullable>): OasString<Nullable> => {
  const {
    type: _type,
    title,
    description,
    format,
    maxLength,
    minLength,
    pattern,
    default: defaultValue,
    ...skipped
  } = v.parse(oasStringData, value)

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    parent: value,
    context
  })

  if (format && !v.is(stringFormat, format)) {
    context.logWarning({
      key: 'format',
      message: `Unexpected format: ${format}`,
      parent: value
    })
  }

  return new OasString<Nullable>({
    title,
    description,
    enums,
    nullable,
    example,
    format,
    maxLength,
    minLength,
    pattern,
    default: defaultValue,
    extensionFields
  })
}
