import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContext } from '../../context/ParseContext.ts'
import { OasBoolean } from './Boolean.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import * as v from 'valibot'
import { oasBooleanData } from './boolean-types.ts'
import { parseNullable } from '../_helpers/parseNullable.ts'
import { parseExample } from '../_helpers/parseExample.ts'
import { parseEnum } from '../_helpers/parseEnum.ts'
import { parseDefault } from '../_helpers/parseDefault.ts'

type ToBooleanArgs = {
  value: OpenAPIV3.SchemaObject
  context: ParseContext
}

export const toBoolean = ({ value, context }: ToBooleanArgs): OasBoolean => {
  const { nullable, value: valueWithoutNullable } = parseNullable({
    value,
    context
  })

  const { example, value: valueWithoutExample } = parseExample({
    value: valueWithoutNullable,
    nullable,
    valibotSchema: v.boolean(),
    context
  })

  const { enum: enums, value: valueWithoutEnums } = parseEnum({
    value: valueWithoutExample,
    nullable,
    valibotSchema: v.boolean(),
    context
  })

  const { default: defaultValue, value: valueWithoutDefault } = parseDefault({
    value: valueWithoutEnums,
    nullable,
    valibotSchema: v.boolean(),
    context
  })

  return toParsedBoolean({
    context,
    nullable,
    example,
    enums,
    defaultValue,
    value: valueWithoutDefault
  })
}

type ToParsedBooleanArgs<Nullable extends boolean | undefined> = {
  value: Omit<OpenAPIV3.SchemaObject, 'nullable' | 'example' | 'enums'>
  context: ParseContext
  nullable: Nullable
  example: Nullable extends true ? boolean | null | undefined : boolean | undefined
  enums: Nullable extends true ? (boolean | null)[] | undefined : boolean[] | undefined
  defaultValue: Nullable extends true ? boolean | null | undefined : boolean | undefined
}

export const toParsedBoolean = <Nullable extends boolean | undefined>({
  context,
  nullable,
  example,
  enums,
  defaultValue,
  value
}: ToParsedBooleanArgs<Nullable>): OasBoolean<Nullable> => {
  const { type: _type, title, description, ...skipped } = v.parse(oasBooleanData, value)

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    parent: value,
    context,
    parentType: 'schema:boolean'
  })

  return new OasBoolean({
    nullable,
    title,
    description,
    example,
    enums: enums,
    default: defaultValue,
    extensionFields
  })
}
