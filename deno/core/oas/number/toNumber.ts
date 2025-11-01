import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContext } from '../../context/ParseContext.ts'
import { OasNumber } from './Number.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import { oasNumberData, numberFormat } from './number-types.ts'
import { parseNullable } from '../_helpers/parseNullable.ts'
import { parseEnum } from '../_helpers/parseEnum.ts'
import * as v from 'valibot'
type ToNumberArgs = {
  value: OpenAPIV3.SchemaObject
  context: ParseContext
}

/**
 * Transforms an OpenAPI v3 number schema object into an internal OAS number representation.
 *
 * This function processes OpenAPI number schemas by extracting and parsing nullable values,
 * examples, enumerations, and default values. It handles the complete transformation from
 * raw OpenAPI JSON to the SKMTC internal number representation with proper validation
 * of number formats and constraints.
 *
 * The transformation follows a pipeline approach:
 * 1. Parse nullable flag and extract base value
 * 2. Parse example values with nullable support
 * 3. Parse enumeration constraints
 * 4. Parse default values
 * 5. Create final OasNumber instance with format validation
 *
 * @param args - Transformation arguments
 * @param args.context - Parse context providing utilities and tracing
 * @param args.value - The OpenAPI v3 number schema object to transform
 * @returns Transformed OAS number object with parsed properties
 *
 * @example Basic number transformation
 * ```typescript
 * import { toNumber } from '@skmtc/core';
 *
 * const openApiNumber = {
 *   type: 'number',
 *   format: 'double',
 *   minimum: 0,
 *   maximum: 100
 * };
 *
 * const oasNumber = toNumber({
 *   context: parseContext,
 *   value: openApiNumber
 * });
 *
 * console.log(oasNumber.format); // 'double'
 * console.log(oasNumber.minimum); // 0
 * ```
 *
 * @example Number with nullable and constraints
 * ```typescript
 * const priceNumber = {
 *   type: 'number',
 *   format: 'float',
 *   nullable: true,
 *   minimum: 0.01,
 *   maximum: 9999.99,
 *   exclusiveMaximum: true,
 *   default: null,
 *   example: 19.99
 * };
 *
 * const oasNumber = toNumber({
 *   context: parseContext,
 *   value: priceNumber
 * });
 *
 * console.log(oasNumber.nullable); // true
 * console.log(oasNumber.exclusiveMaximum); // true
 * ```
 */
export const toNumber = ({ context, value }: ToNumberArgs): OasNumber => {
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
    check: isNumber,
    toMessage: item => `Removed invalid enum. Expected "number", got: ${item}`
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
  const { format: unparsedFormat, ...valueWithoutFormat } = valueWithoutEnums

  const format = parseNumberFormat({
    format: unparsedFormat,
    context,
    parent: valueWithoutEnums
  })

  if (!v.is(oasNumberData, valueWithoutFormat)) {
    v.parse(oasNumberData, valueWithoutFormat)
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
    default: defaultValue,
    ...skipped
  } = valueWithoutFormat

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    parent: valueWithoutFormat,
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

type ParseNumberFormatArgs = {
  format: unknown
  context: ParseContext
  parent: unknown
}

const parseNumberFormat = ({ format, context, parent }: ParseNumberFormatArgs) => {
  if (!v.is(numberFormat, format)) {
    context.logIssue({
      key: 'format',
      level: 'warning',
      message: `Invalid format: ${format}`,
      parent,
      type: 'INVALID_FORMAT'
    })
    return undefined
  }

  return format
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

  if (!isNumber(example)) {
    context.logIssue({
      key: 'example',
      level: 'warning',
      message: `Removed invalid example. Expected "number", got: ${example}`,
      parent,
      type: 'INVALID_EXAMPLE'
    })
    return undefined
  }

  return example
}

const isNumber = (value: unknown): value is number => {
  return typeof value === 'number'
}
