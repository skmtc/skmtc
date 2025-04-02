import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContext } from '../../context/ParseContext.ts'
import { OasInteger } from './Integer.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import { oasIntegerData, integerSchema } from './integer-types.ts'
import * as v from 'valibot'
type ToIntegerArgs = {
  value: OpenAPIV3.NonArraySchemaObject
  context: ParseContext
}

export const toInteger = ({ value, context }: ToIntegerArgs): OasInteger => {
  const { nullable } = value

  const parsedNullable = context.provisionalParse({
    key: 'nullable',
    value: nullable,
    schema: v.optional(v.boolean()),
    toMessage: input => `Invalid nullable: ${input}`
  })

  return parsedNullable
    ? toNullableInteger({ context, nullable: parsedNullable, value })
    : toNonNullableInteger({ context, nullable: parsedNullable, value })
}

type ToNullableIntegerArgs = ToIntegerArgs & {
  nullable: true
}

const toNullableInteger = ({
  context,
  nullable,
  ...args
}: ToNullableIntegerArgs): OasInteger<true> => {
  const { example, enum: enums, nullable: _nullable, ...value } = args.value

  const parsedExample = context.provisionalParse({
    key: 'example',
    value: example,
    schema: v.nullable(integerSchema),
    toMessage: value => `Removed invalid example. Expected integer, got: ${value}`
  })

  const parsedEnums = context.provisionalParse({
    key: 'enum',
    value: enums,
    schema: v.array(v.nullable(integerSchema)),
    toMessage: value => `Removed invalid enum. Expected array of integers or null, got: ${value}`
  })

  const { type: _type, title, description, format, ...skipped } = v.parse(oasIntegerData, value)

  const extensionFields = toSpecificationExtensionsV3({ skipped, context })

  return new OasInteger<true>({
    title,
    description,
    nullable,
    format,
    enums: parsedEnums,
    extensionFields,
    example: parsedExample
  })
}

type ToNonNullableIntegerArgs = ToIntegerArgs & {
  nullable: false | undefined
}

const toNonNullableInteger = ({
  context,
  nullable,
  ...args
}: ToNonNullableIntegerArgs): OasInteger<false | undefined> => {
  const { example, nullable: _nullable, ...value } = args.value

  const parsedExample = context.provisionalParse({
    key: 'example',
    value: example,
    schema: integerSchema,
    toMessage: value => `Removed invalid example. Expected integer, got: ${value}`
  })

  const {
    type: _type,
    enum: enums,
    title,
    description,
    format,
    ...skipped
  } = v.parse(oasIntegerData, value)

  const extensionFields = toSpecificationExtensionsV3({ skipped, context })

  return new OasInteger<false | undefined>({
    title,
    description,
    nullable,
    format,
    enums,
    extensionFields,
    example: parsedExample
  })
}
