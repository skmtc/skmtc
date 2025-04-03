import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContext } from '../../context/ParseContext.ts'
import { OasNumber } from './Number.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import * as v from 'valibot'
import { oasNumberData } from './number-types.ts'

type ToNumberArgs = {
  value: OpenAPIV3.NonArraySchemaObject
  context: ParseContext
}

export const toNumber = ({ value, context }: ToNumberArgs): OasNumber => {
  const { nullable } = value

  const parsedNullable = context.provisionalParse({
    key: 'nullable',
    value: nullable,
    schema: v.optional(v.boolean()),
    toMessage: input => `Invalid nullable: ${input}`
  })

  return parsedNullable
    ? toNullableNumber({ context, nullable: parsedNullable, value })
    : toNonNullableNumber({ context, nullable: parsedNullable, value })
}

type ToNullableNumberArgs = ToNumberArgs & {
  nullable: true
}

export const toNullableNumber = ({
  context,
  nullable,
  ...args
}: ToNullableNumberArgs): OasNumber<true> => {
  const { example, enum: enums, nullable: _nullable, ...value } = args.value

  const parsedExample = context.provisionalParse({
    key: 'example',
    value: example,
    schema: v.nullable(v.number()),
    toMessage: value => `Removed invalid example. Expected number, got: ${value}`
  })

  const parsedEnums = context.provisionalParse({
    key: 'enum',
    value: enums,
    schema: v.array(v.nullable(v.number())),
    toMessage: value => `Removed invalid enum. Expected array of numbers or null, got: ${value}`
  })

  const {
    type: _type,
    title,
    description,
    format,
    multipleOf,
    maximum,
    exclusiveMaximum,
    minimum,
    exclusiveMinimum,
    ...skipped
  } = v.parse(oasNumberData, value)

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    context
  })

  return new OasNumber({
    title,
    description,
    nullable,
    extensionFields,
    example: parsedExample,
    enums: parsedEnums,
    format,
    multipleOf,
    maximum,
    exclusiveMaximum,
    minimum,
    exclusiveMinimum
  })
}

type ToNonNullableNumberArgs = ToNumberArgs & {
  nullable: false | undefined
}

export const toNonNullableNumber = ({
  context,
  nullable,
  ...args
}: ToNonNullableNumberArgs): OasNumber<false | undefined> => {
  const { example, nullable: _nullable, ...value } = args.value

  const parsedExample = context.provisionalParse({
    key: 'example',
    value: example,
    schema: v.number(),
    toMessage: value => `Removed invalid example. Expected number, got: ${value}`
  })

  const {
    type: _type,
    title,
    description,
    enum: enums,
    format,
    multipleOf,
    maximum,
    exclusiveMaximum,
    minimum,
    exclusiveMinimum,
    ...skipped
  } = v.parse(oasNumberData, value)

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    context
  })

  return new OasNumber({
    title,
    description,
    nullable,
    extensionFields,
    example: parsedExample,
    enums,
    format,
    multipleOf,
    maximum,
    exclusiveMaximum,
    minimum,
    exclusiveMinimum
  })
}

type ToXNumberArgs<Nullable extends boolean | undefined> = {
  value: Omit<OpenAPIV3.NonArraySchemaObject, 'nullable' | 'example' | 'enums'>
  context: ParseContext
  nullable: Nullable
  example: Nullable extends true ? number | null | undefined : number | undefined
  enums: Nullable extends true ? (number | null)[] | undefined : number[] | undefined
}

const toXNumber = <Nullable extends boolean | undefined>({
  context,
  nullable,
  example,
  enums,
  value
}: ToXNumberArgs<Nullable>): OasNumber<Nullable> => {
  // const parsedExample = context.provisionalParse({
  //   key: 'example',
  //   value: example,
  //   schema: v.number(),
  //   toMessage: value => `Removed invalid example. Expected number, got: ${value}`
  // })

  const {
    type: _type,
    title,
    description,
    format,
    multipleOf,
    maximum,
    exclusiveMaximum,
    minimum,
    exclusiveMinimum,
    ...skipped
  } = v.parse(oasNumberData, value)

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    context
  })

  return new OasNumber<Nullable>({
    title,
    description,
    nullable,
    extensionFields,
    example,
    enums,
    format,
    multipleOf,
    maximum,
    exclusiveMaximum,
    minimum,
    exclusiveMinimum
  })
}
