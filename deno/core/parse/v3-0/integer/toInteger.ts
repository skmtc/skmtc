import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContextType } from '@/context/parseTypes.ts'
import { OasInteger } from '@/oas/integer/Integer.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import { oasIntegerData, integerFormat } from '@/oas/integer/integer-types.ts'
import { parseNullable } from '../_helpers/parseNullable.ts'
import { parseEnum } from '../_helpers/parseEnum.ts'
import { parseExample } from '../_helpers/parseExample.ts'
import { parseDefault } from '../_helpers/parseDefault.ts'
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
    value: unparsedExample,
    context,
    parent: valueWithoutNullable,
    nullable,
    check: isInteger,
    toMessage: item => `Removed invalid example. Expected "integer", got: ${item}`,
    stackTrail
  })

  const { enum: unparsedEnums, ...valueWithoutEnums } = valueWithoutExample

  const enums = parseEnum({
    value: unparsedEnums,
    nullable,
    parent: valueWithoutExample,
    context,
    check: isInteger,
    toMessage: item => `Removed invalid enum. Expected "integer", got: ${item}`,
    stackTrail
  })

  const { default: unparsedDefaultValue, ...valueWithoutDefault } = valueWithoutEnums

  const defaultValue = parseDefault({
    value: unparsedDefaultValue,
    context,
    parent: valueWithoutEnums,
    nullable,
    check: isInteger,
    toMessage: item => `Removed invalid default. Expected "integer", got: ${item}`,
    stackTrail
  })

  return toParsedInteger({
    context,
    nullable,
    example,
    enums,
    defaultValue,
    value: valueWithoutDefault,
    stackTrail
  })
}

type ToParsedIntegerArgs<Nullable extends boolean | undefined> = {
  value: Omit<OpenAPIV3.SchemaObject, 'nullable' | 'example' | 'enums' | 'default'>
  stackTrail: StackTrail
  context: ParseContextType
  nullable: Nullable
  example: Nullable extends true ? number | null | undefined : number | undefined
  enums: Nullable extends true ? (number | null)[] | undefined : number[] | undefined
  defaultValue: Nullable extends true ? number | null | undefined : number | undefined
}

export const toParsedInteger = <Nullable extends boolean | undefined>({
  context,
  nullable,
  example,
  enums,
  defaultValue,
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

  return context.withStackTrail(stackTrail, () =>
    new OasInteger<Nullable>(
      {
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
      },
      context
    )
  )
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
    // `format` is an open vocabulary; a value the IR's integerFormat can't
    // hold is dropped. Recorded at `debug` — the dropped hint is
    // informational, not a correctness issue.
    context.logIssue({
      key: 'format',
      level: 'debug',
      message: `Invalid format: ${format}`,
      parent,
      stackTrail,
      type: 'INVALID_FORMAT'
    })
    return undefined
  }
  return format
}

const isInteger = (value: unknown): value is number => {
  return Number.isInteger(value)
}
