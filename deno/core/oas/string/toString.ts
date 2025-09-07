import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContext } from '../../context/ParseContext.ts'
import { OasString } from './String.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import { oasStringData, stringFormat } from './string-types.ts'
import * as v from 'valibot'
import { parseNullable } from '../_helpers/parseNullable.ts'
import { parseExample } from '../_helpers/parseExample.ts'
import { parseEnum } from '../_helpers/parseEnum.ts'
import { parseDefault } from '../_helpers/parseDefault.ts'
/**
 * Arguments for transforming an OpenAPI string schema into OAS representation.
 */
type ToStringArgs = {
  /** The OpenAPI v3 schema object to transform (must be type 'string') */
  value: OpenAPIV3.SchemaObject
  /** Parse context providing utilities and tracing capabilities */
  context: ParseContext
}

/**
 * Transforms an OpenAPI v3 string schema object into an internal OAS string representation.
 * 
 * This function processes OpenAPI string schemas by extracting and parsing nullable values,
 * examples, enumerations, and default values. It handles the complete transformation from
 * raw OpenAPI JSON to the SKMTC internal string representation with proper validation
 * of string formats and constraints.
 * 
 * The transformation follows a pipeline approach:
 * 1. Parse nullable flag and extract base value
 * 2. Parse example values with nullable support  
 * 3. Parse enumeration constraints
 * 4. Parse default values
 * 5. Create final OasString instance with format validation
 * 
 * @param args - Transformation arguments
 * @param args.context - Parse context providing utilities and tracing
 * @param args.value - The OpenAPI v3 string schema object to transform
 * @returns Transformed OAS string object with parsed properties
 * 
 * @example Basic string transformation
 * ```typescript
 * import { toString } from '@skmtc/core';
 * 
 * const openApiString = {
 *   type: 'string',
 *   format: 'email',
 *   maxLength: 255,
 *   pattern: '^[\\w.-]+@[\\w.-]+\\.[a-zA-Z]{2,}$'
 * };
 * 
 * const oasString = toString({
 *   context: parseContext,
 *   value: openApiString
 * });
 * 
 * console.log(oasString.format); // 'email'
 * console.log(oasString.maxLength); // 255
 * ```
 * 
 * @example String with nullable and enums
 * ```typescript
 * const statusString = {
 *   type: 'string',
 *   nullable: true,
 *   enum: ['active', 'inactive', 'pending', null],
 *   default: 'active',
 *   example: 'pending'
 * };
 * 
 * const oasString = toString({
 *   context: parseContext,
 *   value: statusString
 * });
 * 
 * console.log(oasString.nullable); // true
 * console.log(oasString.enums); // ['active', 'inactive', 'pending', null]
 * ```
 */
export const toString = ({ context, value }: ToStringArgs): OasString => {
  const { nullable, value: valueWithoutNullable } = parseNullable({
    value,
    context
  })

  const { example, value: valueWithoutExample } = parseExample({
    value: valueWithoutNullable,
    nullable,
    valibotSchema: v.string(),
    context
  })

  const { enum: enums, value: valueWithoutEnums } = parseEnum({
    value: valueWithoutExample,
    nullable,
    valibotSchema: v.string(),
    context
  })

  const { default: defaultValue, value: valueWithoutDefault } = parseDefault({
    value: valueWithoutEnums,
    nullable,
    valibotSchema: v.string(),
    context
  })

  return toParsedString({
    context,
    nullable,
    example,
    enums,
    defaultValue,
    value: valueWithoutDefault
  })
}

type ToParsedStringArgs<Nullable extends boolean | undefined> = {
  value: Omit<OpenAPIV3.SchemaObject, 'nullable' | 'example' | 'enums' | 'default'>
  context: ParseContext
  nullable: Nullable
  example: Nullable extends true ? string | null | undefined : string | undefined
  enums: Nullable extends true ? (string | null)[] | undefined : string[] | undefined
  defaultValue: Nullable extends true ? string | null | undefined : string | undefined
}

/**
 * Creates an OAS string instance from pre-parsed string schema components.
 * 
 * This function is the final step in the string transformation pipeline, taking
 * already-parsed nullable, example, enum, and default values and combining them
 * with the remaining string properties to create the complete OasString instance.
 * 
 * The function handles format validation against known OpenAPI string formats,
 * length constraints parsing, pattern validation, and specification extension
 * processing. It logs warnings for unrecognized formats while still preserving
 * them in the output.
 * 
 * @template Nullable - Boolean type indicating if the string can be null
 * @param args - Pre-parsed string components
 * @param args.context - Parse context for tracing and issue logging
 * @param args.nullable - Parsed nullable flag
 * @param args.example - Parsed example value (type-safe with nullable)
 * @param args.enums - Parsed enumeration constraints (type-safe with nullable)
 * @param args.defaultValue - Parsed default value (type-safe with nullable)
 * @param args.value - OpenAPI string object without parsed fields
 * @returns Complete OAS string instance with all properties and validation
 * 
 * @example Date-time string with validation
 * ```typescript
 * const dateTimeString = toParsedString({
 *   context: parseContext,
 *   nullable: false,
 *   example: '2023-12-25T10:00:00Z',
 *   enums: undefined,
 *   defaultValue: undefined,
 *   value: {
 *     type: 'string',
 *     format: 'date-time',
 *     title: 'Event Date',
 *     description: 'When the event occurs'
 *   }
 * });
 * 
 * console.log(dateTimeString.format); // 'date-time'
 * ```
 * 
 * @example String with custom format (generates warning)
 * ```typescript
 * const customFormatString = toParsedString({
 *   context: parseContext,
 *   nullable: false,
 *   example: 'ABC123',
 *   enums: undefined,
 *   defaultValue: undefined,
 *   value: {
 *     type: 'string',
 *     format: 'custom-id', // Unknown format, will log warning
 *     pattern: '^[A-Z]{3}[0-9]{3}$'
 *   }
 * });
 * 
 * // Logs: "Unexpected format: custom-id"
 * console.log(customFormatString.format); // 'custom-id' (still preserved)
 * ```
 */
export const toParsedString = <Nullable extends boolean | undefined>({
  context,
  nullable,
  example,
  enums,
  defaultValue,
  value
}: ToParsedStringArgs<Nullable>): OasString<Nullable> => {
  const {
    type: _type,
    title,
    description,
    format,
    maxLength,
    minLength,
    pattern,
    ...skipped
  } = v.parse(oasStringData, value)

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    parent: value,
    context,
    parentType: 'schema:string'
  })

  if (format && !v.is(stringFormat, format)) {
    context.logIssue({
      key: 'format',
      level: 'warning',
      message: `Unexpected format: ${format}`,
      parent: value,
      type: 'UNEXPECTED_FORMAT'
    })
  }

  return new OasString<Nullable>({
    title,
    description,
    enums,
    nullable,
    example,
    format,
    maxLength,
    minLength,
    pattern,
    default: defaultValue,
    extensionFields
  })
}
