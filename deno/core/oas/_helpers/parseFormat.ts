import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContext } from '../../context/ParseContext.ts'
import * as v from 'valibot'

/**
 * Arguments for parsing OpenAPI schema format values.
 * 
 * @template T - The expected type of the format value
 */
type ParseFormatArgs<T> = {
  /** The OpenAPI schema object with processed properties removed */
  value: Omit<OpenAPIV3.SchemaObject, 'nullable' | 'example' | 'enums'>
  /** Valibot schema for validating the format value */
  valibotSchema: v.GenericSchema<T>
  /** Parse context for error handling */
  context: ParseContext
}

/**
 * Return type for parsed format data.
 * 
 * @template T - The expected type of the format value
 * @template Value - The OpenAPI schema object type
 */
type ParseFormatReturn<T, Value extends OpenAPIV3.SchemaObject> = {
  /** The parsed and validated format string */
  format: T | undefined
  /** The schema object without the format property */
  value: Omit<Value, 'format'>
}

/**
 * Parses and validates OpenAPI schema format values with type safety.
 * 
 * This function extracts and validates format specifiers from OpenAPI schema objects,
 * ensuring they conform to expected format types for the given schema. Invalid format
 * values are removed and logged as warnings through the parse context.
 * 
 * The format property provides additional semantic information about the expected
 * structure of string values (like 'email', 'date-time', 'uuid', etc.) and numeric
 * precision (like 'float', 'double' for numbers, 'int32', 'int64' for integers).
 * 
 * @template T - The expected type of the format value (usually string)
 * @template Value - The OpenAPI schema object type
 * 
 * @param args - Parsing configuration
 * @returns Parsed format data with the validated format and cleaned schema
 * 
 * @example String format parsing
 * ```typescript
 * import { parseFormat } from '@skmtc/core/oas/_helpers';
 * import * as v from 'valibot';
 * 
 * const result = parseFormat({
 *   value: {
 *     type: 'string',
 *     format: 'email',
 *     maxLength: 100
 *   },
 *   valibotSchema: v.string(),
 *   context: parseContext
 * });
 * 
 * console.log(result.format); // 'email'
 * console.log(result.value);  // { type: 'string', maxLength: 100 }
 * ```
 * 
 * @example Date-time format
 * ```typescript
 * const result = parseFormat({
 *   value: {
 *     type: 'string',
 *     format: 'date-time',
 *     description: 'ISO 8601 timestamp'
 *   },
 *   valibotSchema: v.string(),
 *   context: parseContext
 * });
 * 
 * console.log(result.format); // 'date-time'
 * // Can be used to generate Date objects in TypeScript
 * ```
 * 
 * @example Number precision formats
 * ```typescript
 * const result = parseFormat({
 *   value: {
 *     type: 'number',
 *     format: 'float',
 *     minimum: 0
 *   },
 *   valibotSchema: v.string(), // Format is always a string
 *   context: parseContext
 * });
 * 
 * console.log(result.format); // 'float'
 * // Indicates single-precision floating-point
 * ```
 * 
 * @example Integer format specifiers
 * ```typescript
 * const result = parseFormat({
 *   value: {
 *     type: 'integer',
 *     format: 'int64',
 *     description: 'Large integer ID'
 *   },
 *   valibotSchema: v.string(),
 *   context: parseContext
 * });
 * 
 * console.log(result.format); // 'int64'
 * // Indicates 64-bit signed integer
 * ```
 * 
 * @example Invalid format handling
 * ```typescript
 * const result = parseFormat({
 *   value: {
 *     type: 'string',
 *     format: 123, // Invalid - should be string
 *     pattern: '^[a-z]+$'
 *   } as any,
 *   valibotSchema: v.string(),
 *   context: parseContext
 * });
 * 
 * console.log(result.format); // undefined (invalid format removed)
 * console.log(result.value);  // { type: 'string', pattern: '^[a-z]+$' }
 * // Context will log a warning about the invalid format
 * ```
 * 
 * @example Missing format (undefined)
 * ```typescript
 * const result = parseFormat({
 *   value: {
 *     type: 'string',
 *     minLength: 1,
 *     maxLength: 50
 *   },
 *   valibotSchema: v.string(),
 *   context: parseContext
 * });
 * 
 * console.log(result.format); // undefined (no format specified)
 * console.log(result.value);  // { type: 'string', minLength: 1, maxLength: 50 }
 * ```
 * 
 * @example Common string formats
 * ```typescript
 * // Standard OpenAPI string formats:
 * // - 'date': full-date as defined by RFC3339
 * // - 'date-time': date-time as defined by RFC3339
 * // - 'time': time as defined by RFC3339
 * // - 'email': email address as defined by RFC5322
 * // - 'uri': URI as defined by RFC3986
 * // - 'uuid': UUID as defined by RFC4122
 * // - 'binary': binary data (base64 encoded)
 * // - 'byte': base64 encoded characters
 * // - 'password': hint for UI to obscure input
 * 
 * const emailFormat = parseFormat({
 *   value: { type: 'string', format: 'email' },
 *   valibotSchema: v.string(),
 *   context
 * });
 * // Can generate validation: v.pipe(v.string(), v.email())
 * ```
 */
export const parseFormat = <T, Value extends OpenAPIV3.SchemaObject>({
  value,
  valibotSchema,
  context
}: ParseFormatArgs<T>): ParseFormatReturn<T, Value> => {
  const { format, ...rest } = value

  const parsedFormat = context.provisionalParse({
    key: 'format',
    value: format,
    parent: value,
    schema: v.optional(valibotSchema),
    toMessage: value => `Unexpected "${rest.type}" format: ${value}`,
    type: 'INVALID_FORMAT'
  })

  return {
    format: parsedFormat,
    value: rest
  } as ParseFormatReturn<T, Value>
}
