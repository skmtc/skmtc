import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContext } from '../../context/ParseContext.ts'
import { OasBoolean } from './Boolean.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import * as v from 'valibot'
import { oasBooleanData } from './boolean-types.ts'

type ToBooleanArgs = {
  value: OpenAPIV3.NonArraySchemaObject
  context: ParseContext
}

export const toBoolean = ({ value, context }: ToBooleanArgs): OasBoolean => {
  const { nullable } = value

  const parsedNullable = context.provisionalParse({
    key: 'nullable',
    value: nullable,
    schema: v.optional(v.boolean()),
    toMessage: input => `Invalid nullable: ${input}`
  })

  return parsedNullable
    ? toNullableBoolean({ context, nullable: parsedNullable, value })
    : toNonNullableBoolean({ context, nullable: parsedNullable, value })
}

type ToNullableBooleanArgs = ToBooleanArgs & {
  nullable: true
}

export const toNullableBoolean = ({
  context,
  nullable,
  ...args
}: ToNullableBooleanArgs): OasBoolean<true> => {
  const { example, enum: enums, nullable: _nullable, ...value } = args.value

  const parsedExample = context.provisionalParse({
    key: 'example',
    value: example,
    schema: v.nullable(v.boolean()),
    toMessage: value => `Removed invalid example. Expected boolean, got: ${value}`
  })

  const parsedEnums = context.provisionalParse({
    key: 'enum',
    value: enums,
    schema: v.array(v.nullable(v.boolean())),
    toMessage: value => `Removed invalid enum. Expected array of booleans or null, got: ${value}`
  })

  const {
    type: _type,
    title,
    description,
    default: defaultValue,
    ...skipped
  } = v.parse(oasBooleanData, value)

  const extensionFields = toSpecificationExtensionsV3({ skipped, context })

  return new OasBoolean({
    nullable,
    title,
    description,
    example: parsedExample,
    enum: parsedEnums,
    default: defaultValue,
    extensionFields
  })
}

type ToNonNullableBooleanArgs = ToBooleanArgs & {
  nullable: false | undefined
}

export const toNonNullableBoolean = ({
  context,
  nullable,
  ...args
}: ToNonNullableBooleanArgs): OasBoolean<false | undefined> => {
  const { example, nullable: _nullable, ...value } = args.value

  const parsedExample = context.provisionalParse({
    key: 'example',
    value: example,
    schema: v.boolean(),
    toMessage: value => `Removed invalid example. Expected boolean, got: ${value}`
  })

  const {
    type: _type,
    title,
    description,
    enum: enums,
    default: defaultValue,
    ...skipped
  } = v.parse(oasBooleanData, value)

  const extensionFields = toSpecificationExtensionsV3({ skipped, context })

  return new OasBoolean({
    nullable,
    title,
    description,
    example: parsedExample,
    enum: enums,
    default: defaultValue,
    extensionFields
  })
}
