import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContext } from '../../context/ParseContext.ts'
import { OasObject } from './Object.ts'
import { toOptionalSchemasV3 } from '../schema/toSchemasV3.ts'
import { toAdditionalPropertiesV3 } from './toAdditionalPropertiesV3.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import { parseNullable } from '../_helpers/parseNullable.ts'
import { parseEnum } from '../_helpers/parseEnum.ts'
import { tracer } from '@/helpers/tracer.ts'

type ToObjectArgs = {
  value: OpenAPIV3.SchemaObject
  context: ParseContext
}

export const toObject = ({ value, context }: ToObjectArgs): OasObject => {
  const { nullable, value: valueWithoutNullable } = parseNullable({
    value,
    context
  })

  const { example: unparsedExample, ...valueWithoutExample } = valueWithoutNullable

  const example = parseExample({
    example: unparsedExample,
    context,
    parent: valueWithoutNullable,
    nullable
  })

  const { enum: unparsedEnums, ...valueWithoutEnums } = valueWithoutExample

  const enums = parseEnum({
    value: unparsedEnums,
    nullable,
    parent: valueWithoutExample,
    context,
    check: isObject,
    toMessage: item => `Removed invalid enum. Expected "object", got: ${item}`
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
  value: Omit<OpenAPIV3.SchemaObject, 'nullable' | 'example' | 'enums'>
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
    deprecated,
    properties,
    required,
    maxProperties,
    minProperties,
    additionalProperties,
    default: defaultValue,
    readOnly,
    writeOnly,
    ...skipped
  } = value

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    parent: value,
    context,
    parentType: 'schema:object'
  })

  return new OasObject<Nullable>({
    title,
    description,
    nullable,
    example,
    enums,
    properties: tracer(
      context.stackTrail,
      'properties',
      () =>
        toOptionalSchemasV3({
          schemas: properties,
          context
        })
    ),
    required,
    maxProperties,
    minProperties,
    additionalProperties: tracer(
      context.stackTrail,
      'additionalProperties',
      () => toAdditionalPropertiesV3({ additionalProperties, context })
    ),
    extensionFields,
    default: defaultValue,
    deprecated,
    readOnly,
    writeOnly
  })
}

type ParseExampleArgs = {
  example: unknown
  context: ParseContext
  parent: unknown
  nullable: boolean | undefined
}

const parseExample = ({ example, context, parent, nullable }: ParseExampleArgs) => {
  if (nullable && example === null) {
    return example
  }

  if (!isObject(example)) {
    context.logIssue({
      key: 'example',
      level: 'warning',
      message: `Invalid example: ${example}`,
      parent,
      type: 'INVALID_EXAMPLE'
    })
    return undefined
  }

  return example as Record<string, unknown>
}

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
