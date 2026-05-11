import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContextType } from '@/context/parseTypes.ts'
import { OasInteger } from './Integer.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import { oasIntegerData, integerFormat } from './integer-types.ts'
import { parseNullable } from '../_helpers/parseNullable.ts'
import { parseEnum } from '../_helpers/parseEnum.ts'
import * as v from 'valibot'
import type { StackTrail } from '@/context/StackTrail.ts'

export type ToIntegerArgs = {
  value: OpenAPIV3.SchemaObject
  stackTrail: StackTrail
  context: ParseContextType
}

export const toInteger = ({ value, stackTrail, context }: ToIntegerArgs): OasInteger => {
  const { nullable, value: valueWithoutNullable } = parseNullable({
    value,
    context,
    stackTrail
  })

  const { example: unparsedExample, ...valueWithoutExample } = valueWithoutNullable

  const example = parseExample({
    example: unparsedExample,
    context,
    parent: valueWithoutNullable,
    nullable,
    stackTrail
  })

  const { enum: unparsedEnums, ...valueWithoutEnums } = valueWithoutExample

  const enums = parseEnum({
    value: unparsedEnums,
    nullable,
    parent: valueWithoutExample,
    context,
    check: Number.isInteger,
    toMessage: item => `Removed invalid enum. Expected "integer", got: ${item}`,
    stackTrail
  })

  return toParsedInteger({
    context,
    nullable,
    example,
    enums,
    value: valueWithoutEnums,
    stackTrail
  })
}

type ToParsedIntegerArgs<Nullable extends boolean | undefined> = {
  value: Omit<OpenAPIV3.SchemaObject, 'nullable' | 'example' | 'enums'>
  stackTrail: StackTrail
  context: ParseContextType
  nullable: Nullable
  example: Nullable extends true ? number | null | undefined : number | undefined
  enums: Nullable extends true ? (number | null)[] | undefined : number[] | undefined
}

export const toParsedInteger = <Nullable extends boolean | undefined>({
  context,
  nullable,
  example,
  enums,
  value: valueWithoutEnums,
  stackTrail
}: ToParsedIntegerArgs<Nullable>): OasInteger<Nullable> => {
  const { format: unparsedFormat, ...valueWithoutFormat } = valueWithoutEnums

  const format = parseIntegerFormat({
    format: unparsedFormat,
    context,
    parent: valueWithoutEnums,
    stackTrail
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
    stackTrail,
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
  context: ParseContextType
  parent: unknown
  stackTrail: StackTrail
}

const parseIntegerFormat = ({ format, context, parent, stackTrail }: ParseIntegerFormatArgs) => {
  if (format === undefined) {
    return undefined
  }

  if (!v.is(integerFormat, format)) {
    context.logIssue({
      key: 'format',
      level: 'warning',
      message: `Invalid format: ${format}`,
      parent,
      stackTrail,
      type: 'INVALID_FORMAT'
    })
    return undefined
  }
  return format
}

type ParseExampleArgs = {
  example: unknown
  context: ParseContextType
  parent: unknown
  nullable: boolean | undefined
  stackTrail: StackTrail
}

const parseExample = ({ example, context, parent, nullable, stackTrail }: ParseExampleArgs) => {
  if (example === undefined) {
    return undefined
  }

  if (nullable && example === null) {
    return example
  }

  if (!isInteger(example)) {
    context.logIssue({
      key: 'example',
      level: 'warning',
      message: `Removed invalid example. Expected "integer", got: ${example}`,
      parent,
      stackTrail,
      type: 'INVALID_EXAMPLE'
    })
    return undefined
  }

  return example
}

const isInteger = (value: unknown): value is number => {
  return Number.isInteger(value)
}
