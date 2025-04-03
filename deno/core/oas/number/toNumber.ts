import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContext } from '../../context/ParseContext.ts'
import { OasNumber } from './Number.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import * as v from 'valibot'
import { oasNumberData } from './number-types.ts'
import { parseNullable } from '../helpers/parseNullable.ts'
import { parseExample } from '../helpers/parseExample.ts'
import { parseEnum } from '../helpers/parseEnum.ts'
type ToNumberArgs = {
  value: OpenAPIV3.NonArraySchemaObject
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
  value: Omit<OpenAPIV3.NonArraySchemaObject, 'nullable' | 'example' | 'enums'>
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
  value
}: ToParsedNumberArgs<Nullable>): OasNumber<Nullable> => {
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
