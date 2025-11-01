import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContext } from '../../context/ParseContext.ts'
import { OasInteger } from './Integer.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import { oasIntegerData, integerFormat } from './integer-types.ts'
import { parseNullable } from '../_helpers/parseNullable.ts'
import { parseEnum } from '../_helpers/parseEnum.ts'
import * as v from 'valibot'

type ToIntegerArgs = {
  value: OpenAPIV3.SchemaObject
  context: ParseContext
}

export const toInteger = ({ value, context }: ToIntegerArgs): OasInteger => {
  const { nullable, value: valueWithoutNullable } = parseNullable({
    value,
    context
  })

  const { example: unparsedExample, ...valueWithoutExample } = valueWithoutNullable

  const example = parseExample({
    example: unparsedExample,
    context,
    parent: valueWithoutNullable,
    nullable
  })

  const { enum: unparsedEnums, ...valueWithoutEnums } = valueWithoutExample

  const enums = parseEnum({
    value: unparsedEnums,
    nullable,
    parent: valueWithoutExample,
    context,
    check: Number.isInteger,
    toMessage: item => `Removed invalid enum. Expected "integer", got: ${item}`
  })

  return toParsedInteger({
    context,
    nullable,
    example,
    enums,
    value: valueWithoutEnums
  })
}

type ToParsedIntegerArgs<Nullable extends boolean | undefined> = {
  value: Omit<OpenAPIV3.SchemaObject, 'nullable' | 'example' | 'enums'>
  context: ParseContext
  nullable: Nullable
  example: Nullable extends true ? number | null | undefined : number | undefined
  enums: Nullable extends true ? (number | null)[] | undefined : number[] | undefined
}

export const toParsedInteger = <Nullable extends boolean | undefined>({
  context,
  nullable,
  example,
  enums,
  value: valueWithoutEnums
}: ToParsedIntegerArgs<Nullable>): OasInteger<Nullable> => {
  const { format: unparsedFormat, ...valueWithoutFormat } = valueWithoutEnums

  const format = parseIntegerFormat({
    format: unparsedFormat,
    context,
    parent: valueWithoutEnums
  })

  if (!v.is(oasIntegerData, valueWithoutFormat)) {
    v.parse(oasIntegerData, valueWithoutFormat)
  }

  const {
    type: _type,
    title,
    description,
    default: defaultValue,
    multipleOf,
    maximum,
    exclusiveMaximum,
    minimum,
    exclusiveMinimum,
    readOnly,
    writeOnly,
    deprecated,
    ...skipped
  } = valueWithoutFormat

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    parent: valueWithoutEnums,
    context,
    parentType: 'schema:integer'
  })

  return new OasInteger<Nullable>({
    title,
    description,
    nullable,
    format,
    enums,
    example,
    multipleOf,
    maximum,
    exclusiveMaximum,
    minimum,
    exclusiveMinimum,
    default: defaultValue,
    readOnly,
    writeOnly,
    extensionFields,
    deprecated
  })
}

type ParseIntegerFormatArgs = {
  format: unknown
  context: ParseContext
  parent: unknown
}

const parseIntegerFormat = ({ format, context, parent }: ParseIntegerFormatArgs) => {
  if (!v.is(integerFormat, format)) {
    context.logIssue({
      key: 'format',
      level: 'warning',
      message: `Invalid format: ${format}`,
      parent,
      type: 'INVALID_FORMAT'
    })
    return undefined
  }
  return format
}

type ParseExampleArgs = {
  example: unknown
  context: ParseContext
  parent: unknown
  nullable: boolean | undefined
}

const parseExample = ({ example, context, parent, nullable }: ParseExampleArgs) => {
  if (nullable && example === null) {
    return example
  }

  if (!isInteger(example)) {
    context.logIssue({
      key: 'example',
      level: 'warning',
      message: `Removed invalid example. Expected "integer", got: ${example}`,
      parent,
      type: 'INVALID_EXAMPLE'
    })
    return undefined
  }

  return example
}

const isInteger = (value: unknown): value is number => {
  return Number.isInteger(value)
}
