import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContextType } from '@/context/parseTypes.ts'
import { OasNumber } from './Number.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import { oasNumberData, numberFormat } from './number-types.ts'
import { parseNullable } from '../_helpers/parseNullable.ts'
import { parseEnum } from '../_helpers/parseEnum.ts'
import * as v from 'valibot'
import type { StackTrail } from '@/context/StackTrail.ts'
type ToNumberArgs = {
  value: OpenAPIV3.SchemaObject
  stackTrail: StackTrail
  context: ParseContextType
}

export const toNumber = ({ context, value, stackTrail }: ToNumberArgs): OasNumber => {
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
    stackTrail,
    parent: valueWithoutExample,
    context,
    check: isNumber,
    toMessage: item => `Removed invalid enum. Expected "number", got: ${item}`
  })

  return toParsedNumber({
    context,
    nullable,
    example,
    enums,
    value: valueWithoutEnums,
    stackTrail
  })
}

type ToParsedNumberArgs<Nullable extends boolean | undefined> = {
  value: Omit<OpenAPIV3.SchemaObject, 'nullable' | 'example' | 'enums'>
  stackTrail: StackTrail
  context: ParseContextType
  nullable: Nullable
  example: Nullable extends true ? number | null | undefined : number | undefined
  enums: Nullable extends true ? (number | null)[] | undefined : number[] | undefined
}

const toParsedNumber = <Nullable extends boolean | undefined>({
  context,
  nullable,
  example,
  enums,
  value: valueWithoutEnums,
  stackTrail
}: ToParsedNumberArgs<Nullable>): OasNumber<Nullable> => {
  const { format: unparsedFormat, ...valueWithoutFormat } = valueWithoutEnums

  const format = parseNumberFormat({
    format: unparsedFormat,
    context,
    stackTrail,
    parent: valueWithoutEnums
  })

  if (!v.is(oasNumberData, valueWithoutFormat)) {
    v.parse(oasNumberData, valueWithoutFormat)
  }

  const {
    type: _type,
    title,
    description,
    multipleOf,
    maximum,
    exclusiveMaximum,
    minimum,
    exclusiveMinimum,
    default: defaultValue,
    readOnly,
    writeOnly,
    deprecated,
    ...skipped
  } = valueWithoutFormat

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    parent: valueWithoutFormat,
    context,
    stackTrail,
    parentType: 'schema:number'
  })

  return new OasNumber<Nullable>({
    title,
    description,
    nullable,
    default: defaultValue,
    extensionFields,
    example,
    enums,
    format,
    multipleOf,
    maximum,
    exclusiveMaximum,
    minimum,
    readOnly,
    writeOnly,
    exclusiveMinimum,
    deprecated
  })
}

type ParseNumberFormatArgs = {
  format: unknown
  context: ParseContextType
  parent: unknown
  stackTrail: StackTrail
}

const parseNumberFormat = ({ format, context, parent, stackTrail }: ParseNumberFormatArgs) => {
  if (format === undefined) {
    return undefined
  }

  if (!v.is(numberFormat, format)) {
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

  if (!isNumber(example)) {
    context.logIssue({
      key: 'example',
      level: 'warning',
      message: `Removed invalid example. Expected "number", got: ${example}`,
      parent,
      stackTrail,
      type: 'INVALID_EXAMPLE'
    })
    return undefined
  }

  return example
}

const isNumber = (value: unknown): value is number => {
  return typeof value === 'number'
}
