import type { OpenAPIV3 } from 'openapi-types'
import { OasArray } from './Array.ts'
import { toSchemaV3 } from '../schema/toSchemasV3.ts'
import type { ParseContext } from '../../context/ParseContext.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import { parseNullable } from '../_helpers/parseNullable.ts'
import { parseExample } from '../_helpers/parseExample.ts'
import { parseEnum } from '../_helpers/parseEnum.ts'
import * as v from 'valibot'
import { oasArrayData } from './array-types.ts'
import { parseDefault } from '../_helpers/parseDefault.ts'
type ToArrayArgs = {
  value: OpenAPIV3.ArraySchemaObject
  context: ParseContext
}

export const toArray = ({ value, context }: ToArrayArgs): OasArray => {
  const { nullable, value: valueWithoutNullable } = parseNullable({
    value,
    context
  })

  const { example, value: valueWithoutExample } = parseExample({
    value: valueWithoutNullable,
    nullable,
    valibotSchema: v.array(v.any()),
    context
  })

  const { enum: enums, value: valueWithoutEnums } = parseEnum({
    value: valueWithoutExample,
    nullable,
    valibotSchema: v.array(v.any()),
    context
  })

  const { default: defaultValue, value: valueWithoutDefault } = parseDefault({
    value: valueWithoutEnums,
    nullable,
    valibotSchema: v.array(v.any()),
    context
  })

  return toParsedArray({
    context,
    nullable,
    example,
    enums,
    defaultValue,
    value: valueWithoutDefault
  })
}

type ToParsedArrayArgs<Nullable extends boolean | undefined> = {
  value: Omit<OpenAPIV3.ArraySchemaObject, 'nullable' | 'example' | 'enums' | 'default'>
  context: ParseContext
  nullable: Nullable
  example: Nullable extends true ? unknown[] | null | undefined : unknown[] | undefined
  enums: Nullable extends true ? (unknown[] | null)[] | undefined : unknown[] | undefined
  defaultValue: Nullable extends true ? unknown[] | null | undefined : unknown[] | undefined
}

export const toParsedArray = <Nullable extends boolean | undefined>({
  context,
  nullable,
  example,
  enums,
  defaultValue,
  value
}: ToParsedArrayArgs<Nullable>): OasArray<Nullable> => {
  // We only want parse non-items fields here since items is handled below
  const { items, ...rest } = value

  const oasArrayDataSchemaWithItems = v.omit(oasArrayData, ['items'])

  const {
    type: _type,
    title,
    description,
    uniqueItems,
    maxItems,
    minItems,
    ...skipped
  } = v.parse(oasArrayDataSchemaWithItems, rest)

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    parent: value,
    context,
    parentType: 'schema:array'
  })

  return new OasArray({
    title,
    description,
    nullable,
    defaultValue,
    items: context.trace('items', () => toSchemaV3({ schema: items, context })),
    extensionFields,
    example,
    uniqueItems,
    maxItems,
    minItems,
    enums
  })
}
