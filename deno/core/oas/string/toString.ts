import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContext } from '../../context/ParseContext.ts'
import { OasString } from './String.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import { oasStringData, stringFormat } from './string-types.ts'
import * as v from 'valibot'
type ToStringArgs = {
  value: OpenAPIV3.NonArraySchemaObject
  context: ParseContext
}

export const toString = ({ context, value }: ToStringArgs) => {
  const { nullable } = value

  const parsedNullable = context.provisionalParse({
    key: 'nullable',
    value: nullable,
    schema: v.optional(v.boolean()),
    toMessage: input => `Invalid nullable: ${input}`
  })

  return parsedNullable
    ? toNullableString({ context, value, nullable: parsedNullable })
    : toNonNullableString({ context, value, nullable: parsedNullable })
}

type ToNullableStringArgs = ToStringArgs & {
  nullable: true
}

const toNullableString = ({
  context,
  nullable,
  ...args
}: ToNullableStringArgs): OasString<true> => {
  const { example, enum: enums, nullable: _nullable, ...value } = args.value

  const parsedExample = context.provisionalParse({
    key: 'example',
    value: example,
    schema: v.nullable(v.string()),
    toMessage: value => `Removed invalid example. Expected string, got: ${value}`
  })

  const parsedEnums = context.provisionalParse({
    key: 'enum',
    value: enums,
    schema: v.array(v.nullable(v.string())),
    toMessage: value => `Removed invalid enum. Expected array of strings or null, got: ${value}`
  })

  const {
    type: _type,
    title,
    description,
    format,
    maxLength,
    minLength,
    ...skipped
  } = v.parse(oasStringData, value)

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    context
  })

  if (format && !v.is(stringFormat, format)) {
    context.logWarning({
      key: 'format',
      message: `Invalid format: ${format}`
    })
  }

  return new OasString<true>({
    title,
    description,
    enums: parsedEnums,
    nullable: nullable,
    example: parsedExample,
    format,
    maxLength,
    minLength,
    extensionFields
  })
}

type ToNonNullableStringArgs = ToStringArgs & {
  nullable: false | undefined
}

const toNonNullableString = ({
  context,
  nullable,
  ...args
}: ToNonNullableStringArgs): OasString<false | undefined> => {
  const { example, nullable: _nullable, ...value } = args.value

  const parsedExample = context.provisionalParse({
    key: 'example',
    value: example,
    schema: v.string(),
    toMessage: value => `Removed invalid example. Expected string, got: ${value}`
  })

  const {
    type: _type,
    title,
    description,
    enum: enums,
    format,
    maxLength,
    minLength,
    ...skipped
  } = v.parse(oasStringData, value)

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    context
  })

  if (format && !v.is(stringFormat, format)) {
    context.logWarning({
      key: 'format',
      message: `Invalid format: ${format}`
    })
  }

  return new OasString({
    title,
    description,
    enums,
    nullable,
    example: parsedExample,
    format,
    maxLength,
    minLength,
    extensionFields
  })
}
