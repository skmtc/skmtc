import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContextType } from '@/context/parseTypes.ts'
import { OasObject } from './Object.ts'
import { toOptionalSchemasV3 } from '../schema/toSchemasV3.ts'
import { toAdditionalPropertiesV3 } from './toAdditionalPropertiesV3.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import { parseNullable } from '../_helpers/parseNullable.ts'
import { parseEnum } from '../_helpers/parseEnum.ts'
import { parseExample } from '../_helpers/parseExample.ts'
import { parseDefault } from '../_helpers/parseDefault.ts'

import type { StackTrail } from '@/context/StackTrail.ts'

export type ToObjectArgs = {
  value: OpenAPIV3.SchemaObject
  context: ParseContextType
  stackTrail: StackTrail
}

export const toObject = ({ value, context, stackTrail }: ToObjectArgs): OasObject => {
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
    check: isObject,
    toMessage: item => `Removed invalid example. Expected "object", got: ${item}`,
    stackTrail
  })

  const { enum: unparsedEnums, ...valueWithoutEnums } = valueWithoutExample

  const enums = parseEnum({
    value: unparsedEnums,
    nullable,
    parent: valueWithoutExample,
    context,
    stackTrail,
    check: isObject,
    toMessage: item => `Removed invalid enum. Expected "object", got: ${item}`
  })

  const { default: unparsedDefaultValue, ...valueWithoutDefault } = valueWithoutEnums

  const defaultValue = parseDefault({
    value: unparsedDefaultValue,
    context,
    parent: valueWithoutEnums,
    nullable,
    check: isObject,
    toMessage: item => `Removed invalid default. Expected "object", got: ${item}`,
    stackTrail
  })

  return toParsedObject({
    context,
    nullable,
    example,
    enums,
    defaultValue,
    value: valueWithoutDefault,
    stackTrail
  })
}

type ToParsedObjectArgs<Nullable extends boolean | undefined> = {
  value: Omit<OpenAPIV3.SchemaObject, 'nullable' | 'example' | 'enums' | 'default'>
  stackTrail: StackTrail
  context: ParseContextType
  nullable: Nullable
  example: Nullable extends true
    ? Record<string, unknown> | null | undefined
    : Record<string, unknown> | undefined
  enums: Nullable extends true
    ? (Record<string, unknown> | null)[] | undefined
    : Record<string, unknown>[] | undefined
  defaultValue: Nullable extends true
    ? Record<string, unknown> | null | undefined
    : Record<string, unknown> | undefined
}

const toParsedObject = <Nullable extends boolean | undefined>({
  context,
  stackTrail,
  nullable,
  example,
  enums,
  defaultValue,
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
    readOnly,
    writeOnly,
    ...skipped
  } = value

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    parent: value,
    context,
    stackTrail,
    parentType: 'schema:object'
  })

  return context.withStackTrail(stackTrail, () =>
    new OasObject<Nullable>(
      {
        title,
        description,
        nullable,
        example,
        enums,
        properties: stackTrail.trace('properties', st =>
          toOptionalSchemasV3({
            schemas: properties,
            stackTrail: st,
            context
          })
        ),
        required,
        maxProperties,
        minProperties,
        additionalProperties: stackTrail.trace('additionalProperties', st =>
          toAdditionalPropertiesV3({ additionalProperties, stackTrail: st, context })
        ),
        extensionFields,
        default: defaultValue,
        deprecated,
        readOnly,
        writeOnly
      },
      context
    )
  )
}

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
