import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContext } from '../../context/ParseContext.ts'
import { OasInteger } from './Integer.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import { oasIntegerData, integerSchema, integerFormat } from './integer-types.ts'
import * as v from 'valibot'
import { parseNullable } from '../_helpers/parseNullable.ts'
import { parseExample } from '../_helpers/parseExample.ts'
import { parseEnum } from '../_helpers/parseEnum.ts'
import { parseFormat } from '../_helpers/parseFormat.ts'

type ToIntegerArgs = {
  value: OpenAPIV3.SchemaObject
  context: ParseContext
}

export const toInteger = ({ value, context }: ToIntegerArgs): OasInteger => {
  const { nullable, value: valueWithoutNullable } = parseNullable({
    value,
    context
  })

  const { example, value: valueWithoutExample } = parseExample({
    value: valueWithoutNullable,
    nullable,
    valibotSchema: integerSchema,
    context
  })

  const { enum: enums, value: valueWithoutEnums } = parseEnum({
    value: valueWithoutExample,
    nullable,
    valibotSchema: integerSchema,
    context
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
  const { format, value: valueWithoutFormat } = parseFormat({
    value: valueWithoutEnums,
    valibotSchema: integerFormat,
    context
  })

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
    ...skipped
  } = v.parse(oasIntegerData, valueWithoutFormat)

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
    extensionFields
  })
}
