import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContext } from '../../context/ParseContext.ts'
import { OasBoolean } from './Boolean.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import { oasBooleanData } from './boolean-types.ts'
import { parseNullable } from '../_helpers/parseNullable.ts'
import { parseEnum } from '../_helpers/parseEnum.ts'
import * as v from 'valibot'

type ToBooleanArgs = {
  value: OpenAPIV3.SchemaObject
  context: ParseContext
}

/**
 * Transforms an OpenAPI v3 boolean schema object into an internal OAS boolean representation.
 *
 * This function processes OpenAPI boolean schemas by extracting and parsing nullable values,
 * examples, enumerations, and default values. It handles the complete transformation from
 * raw OpenAPI JSON to the SKMTC internal boolean representation with proper validation.
 *
 * The transformation follows a pipeline approach:
 * 1. Parse nullable flag and extract base value
 * 2. Parse example values with nullable support
 * 3. Parse enumeration constraints (typically [true], [false], or [true, false])
 * 4. Parse default values
 * 5. Create final OasBoolean instance
 *
 * @param args - Transformation arguments
 * @param args.value - The OpenAPI v3 boolean schema object to transform
 * @param args.context - Parse context providing utilities and tracing
 * @returns Transformed OAS boolean object with parsed properties
 *
 * @example Basic boolean transformation
 * ```typescript
 * import { toBoolean } from '@skmtc/core';
 *
 * const openApiBoolean = {
 *   type: 'boolean',
 *   default: false
 * };
 *
 * const oasBoolean = toBoolean({
 *   value: openApiBoolean,
 *   context: parseContext
 * });
 *
 * console.log(oasBoolean.default); // false
 * ```
 *
 * @example Boolean with nullable and enum
 * ```typescript
 * const flagBoolean = {
 *   type: 'boolean',
 *   nullable: true,
 *   enum: [true, null],
 *   default: null,
 *   example: true,
 *   title: 'Feature Flag',
 *   description: 'Whether the feature is enabled'
 * };
 *
 * const oasBoolean = toBoolean({
 *   value: flagBoolean,
 *   context: parseContext
 * });
 *
 * console.log(oasBoolean.nullable); // true
 * console.log(oasBoolean.enums); // [true, null]
 * ```
 */
export const toBoolean = ({ value, context }: ToBooleanArgs): OasBoolean => {
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
  // const { enum: enums, value: valueWithoutEnums } = parseEnum({
  //   value: valueWithoutExample,
  //   nullable,
  //   valibotSchema: v.boolean(),
  //   context
  // })

  const { enum: unparsedEnums, ...valueWithoutEnums } = valueWithoutExample

  const enums = parseEnum({
    value: unparsedEnums,
    nullable,
    parent: valueWithoutExample,
    context,
    check: isBoolean,
    toMessage: item => `Removed invalid enum. Expected "boolean", got: ${item}`
  })

  const { default: unparsedDefaultValue, ...valueWithoutDefault } = valueWithoutEnums

  const defaultValue = parseDefault({
    defaultValue: unparsedDefaultValue,
    context,
    parent: valueWithoutEnums,
    nullable
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
  if (!v.is(oasBooleanData, value)) {
    v.parse(oasBooleanData, value)
  }

  const { type: _type, title, description, readOnly, writeOnly, deprecated, ...skipped } = value

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
    extensionFields,
    readOnly,
    writeOnly,
    deprecated
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

  if (typeof example !== 'boolean') {
    context.logIssue({
      key: 'example',
      level: 'warning',
      message: `Removed invalid example. Expected "boolean", got: ${example}`,
      parent,
      type: 'INVALID_EXAMPLE'
    })
    return undefined
  }

  return example
}

type ParseDefaultArgs = {
  defaultValue: unknown
  context: ParseContext
  parent: unknown
  nullable: boolean | undefined
}

const parseDefault = ({ defaultValue, context, parent, nullable }: ParseDefaultArgs) => {
  if (nullable && defaultValue === null) {
    return defaultValue
  }

  if (typeof defaultValue !== 'boolean') {
    context.logIssue({
      key: 'default',
      level: 'warning',
      message: `Removed invalid default. Expected "boolean", got: ${defaultValue}`,
      parent,
      type: 'INVALID_DEFAULT'
    })
    return undefined
  }

  return defaultValue
}

const isBoolean = (value: unknown): value is boolean => {
  return typeof value === 'boolean'
}
