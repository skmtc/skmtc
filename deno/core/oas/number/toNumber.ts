import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContext } from '../../context/ParseContext.ts'
import { OasNumber } from './Number.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import * as v from 'valibot'
import { oasNumberData, numberFormat } from './number-types.ts'
import { parseNullable } from '../_helpers/parseNullable.ts'
import { parseExample } from '../_helpers/parseExample.ts'
import { parseEnum } from '../_helpers/parseEnum.ts'
import { parseFormat } from '../_helpers/parseFormat.ts'
type ToNumberArgs = {
  value: OpenAPIV3.SchemaObject
  context: ParseContext
}

export const toNumber = ({ context, value }: ToNumberArgs): OasNumber => {
  const { nullable, value: valueWithoutNullable } = parseNullable({
    value,
    context
  })

  const { example, value: valueWithoutExample } = parseExample({
    value: valueWithoutNullable,
    nullable,
    valibotSchema: v.number(),
    context
  })

  const { enum: enums, value: valueWithoutEnums } = parseEnum({
    value: valueWithoutExample,
    nullable,
    valibotSchema: v.number(),
    context
  })

  return toParsedNumber({
    context,
    nullable,
    example,
    enums,
    value: valueWithoutEnums
  })
}

type ToParsedNumberArgs<Nullable extends boolean | undefined> = {
  value: Omit<OpenAPIV3.SchemaObject, 'nullable' | 'example' | 'enums'>
  context: ParseContext
  nullable: Nullable
  example: Nullable extends true ? number | null | undefined : number | undefined
  enums: Nullable extends true ? (number | null)[] | undefined : number[] | undefined
}

const toParsedNumber = <Nullable extends boolean | undefined>({
  context,
  nullable,
  example,
  enums,
  value: valueWithoutEnums
}: ToParsedNumberArgs<Nullable>): OasNumber<Nullable> => {
  const { format, value: valueWithoutFormat } = parseFormat({
    value: valueWithoutEnums,
    valibotSchema: numberFormat,
    context
  })

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
    ...skipped
  } = v.parse(oasNumberData, valueWithoutFormat)

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    parent: valueWithoutEnums,
    context,
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
    exclusiveMinimum
  })
}
