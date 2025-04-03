import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContext } from '../../context/ParseContext.ts'
import { OasObject } from './Object.ts'
import { toOptionalSchemasV3 } from '../schema/toSchemasV3.ts'
import { toAdditionalPropertiesV3 } from './toAdditionalPropertiesV3.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import { parseNullable } from '../helpers/parseNullable.ts'
import { parseExample } from '../helpers/parseExample.ts'
import { parseEnum } from '../helpers/parseEnum.ts'
import * as v from 'valibot'

type ToObjectArgs = {
  value: OpenAPIV3.NonArraySchemaObject
  context: ParseContext
}

export const toObject = ({ value, context }: ToObjectArgs): OasObject => {
  const { nullable, value: valueWithoutNullable } = parseNullable({
    value,
    context
  })

  const { example, value: valueWithoutExample } = parseExample({
    value: valueWithoutNullable,
    nullable,
    valibotSchema: v.record(v.string(), v.any()),
    context
  })

  const { enum: enums, value: valueWithoutEnums } = parseEnum({
    value: valueWithoutExample,
    nullable,
    valibotSchema: v.record(v.string(), v.any()),
    context
  })

  return toParsedObject({
    context,
    nullable,
    example,
    enums,
    value: valueWithoutEnums
  })
}

type ToParsedObjectArgs<Nullable extends boolean | undefined> = {
  value: Omit<OpenAPIV3.NonArraySchemaObject, 'nullable' | 'example' | 'enums'>
  context: ParseContext
  nullable: Nullable
  example: Nullable extends true
    ? Record<string, unknown> | null | undefined
    : Record<string, unknown> | undefined
  enums: Nullable extends true
    ? (Record<string, unknown> | null)[] | undefined
    : Record<string, unknown>[] | undefined
}

const toParsedObject = <Nullable extends boolean | undefined>({
  context,
  nullable,
  example,
  enums,
  value
}: ToParsedObjectArgs<Nullable>): OasObject<Nullable> => {
  const {
    type: _type,
    title,
    description,
    properties,
    required,
    additionalProperties,
    default: defaultValue,
    ...skipped
  } = value

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    context
  })

  return new OasObject<Nullable>({
    title,
    description,
    nullable,
    example,
    enums,
    properties: context.trace('properties', () =>
      toOptionalSchemasV3({
        schemas: properties,
        context
      })
    ),
    required,
    additionalProperties: context.trace('additionalProperties', () =>
      toAdditionalPropertiesV3({ additionalProperties, context })
    ),
    extensionFields,
    default: defaultValue
  })
}
