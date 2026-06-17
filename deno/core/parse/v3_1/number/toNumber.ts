import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContextType } from '@/context/parseTypes.ts'
import { OasNumber } from '@/oas/number/Number.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import { oasNumberData, numberFormat } from '@/oas/number/number-types.ts'
import { parseNullable } from '../_helpers/parseNullable.ts'
import { parseEnum } from '../_helpers/parseEnum.ts'
import { parseExample } from '../_helpers/parseExample.ts'
import { parseDefault } from '../_helpers/parseDefault.ts'
import * as v from 'valibot'
import type { StackTrail } from '@/context/StackTrail.ts'
export type ToNumberArgs = {
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
    value: unparsedExample,
    context,
    parent: valueWithoutNullable,
    nullable,
    check: isNumber,
    toMessage: item => `Removed invalid example. Expected "number", got: ${item}`,
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

  const { default: unparsedDefaultValue, ...valueWithoutDefault } = valueWithoutEnums

  const defaultValue = parseDefault({
    value: unparsedDefaultValue,
    context,
    parent: valueWithoutEnums,
    nullable,
    check: isNumber,
    toMessage: item => `Removed invalid default. Expected "number", got: ${item}`,
    stackTrail
  })

  return toParsedNumber({
    context,
    nullable,
    example,
    enums,
    defaultValue,
    value: valueWithoutDefault,
    stackTrail
  })
}

type ToParsedNumberArgs<Nullable extends boolean | undefined> = {
  value: Omit<OpenAPIV3.SchemaObject, 'nullable' | 'example' | 'enums' | 'default'>
  stackTrail: StackTrail
  context: ParseContextType
  nullable: Nullable
  example: Nullable extends true ? number | null | undefined : number | undefined
  enums: Nullable extends true ? (number | null)[] | undefined : number[] | undefined
  defaultValue: Nullable extends true ? number | null | undefined : number | undefined
}

const toParsedNumber = <Nullable extends boolean | undefined>({
  context,
  nullable,
  example,
  enums,
  defaultValue,
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

  return context.withStackTrail(stackTrail, () =>
    new OasNumber<Nullable>(
      {
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
      },
      context
    )
  )
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

const isNumber = (value: unknown): value is number => {
  return typeof value === 'number'
}
