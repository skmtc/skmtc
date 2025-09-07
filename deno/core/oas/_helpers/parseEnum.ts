import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContext } from '../../context/ParseContext.ts'
import * as v from 'valibot'

/**
 * Arguments for parsing OpenAPI schema enum values.
 * 
 * @template T - The expected type of enum values
 * @template Nullable - Whether the schema allows null values
 * @template Value - The OpenAPI schema object type
 */
type ParseEnumArgs<
  T,
  Nullable extends boolean | undefined,
  Value extends OpenAPIV3.SchemaObject
> = {
  /** The OpenAPI schema object without nullable property */
  value: Omit<Value, 'nullable'>
  /** Whether the schema allows null values */
  nullable: Nullable
  /** Valibot schema for validating enum values */
  valibotSchema: v.GenericSchema<T>
  /** Parse context for error handling */
  context: ParseContext
}

/**
 * Return type for parsed enum data.
 * 
 * @template T - The expected type of enum values
 * @template Nullable - Whether the schema allows null values
 * @template Value - The OpenAPI schema object type
 */
type ParseEnumReturn<
  T,
  Nullable extends boolean | undefined,
  Value extends OpenAPIV3.SchemaObject
> = {
  /** The parsed and validated enum array */
  enum: Nullable extends true ? (T | null)[] | undefined : T[] | undefined
  /** The schema object without enum and nullable properties */
  value: Omit<Value, 'nullable' | 'enum'>
}

/**
 * Parses and validates OpenAPI schema enum values with type safety.
 * 
 * This function extracts and validates enum arrays from OpenAPI schema objects,
 * ensuring all enum values conform to the expected type and handling nullable
 * schemas correctly. Invalid enum values are removed and logged as warnings
 * through the parse context.
 * 
 * The function provides full type safety, with the return type reflecting whether
 * null values are allowed in the enum array based on the nullable parameter.
 * 
 * @template T - The expected type of enum values
 * @template Nullable - Whether the schema allows null values in enums
 * @template Value - The OpenAPI schema object type
 * 
 * @param args - Parsing configuration
 * @returns Parsed enum data with the validated enum array and cleaned schema
 * 
 * @example Basic string enum parsing
 * ```typescript
 * import { parseEnum } from '@skmtc/core/oas/_helpers';
 * import * as v from 'valibot';
 * 
 * const result = parseEnum({
 *   value: {
 *     type: 'string',
 *     enum: ['active', 'inactive', 'pending'],
 *     description: 'User status'
 *   },
 *   nullable: false,
 *   valibotSchema: v.string(),
 *   context: parseContext
 * });
 * 
 * console.log(result.enum); // ['active', 'inactive', 'pending']
 * console.log(result.value); // { type: 'string', description: 'User status' }
 * ```
 * 
 * @example Nullable enum parsing
 * ```typescript
 * const result = parseEnum({
 *   value: {
 *     type: 'string',
 *     enum: ['red', 'green', 'blue', null],
 *     description: 'Optional color selection'
 *   },
 *   nullable: true,
 *   valibotSchema: v.string(),
 *   context: parseContext
 * });
 * 
 * console.log(result.enum); // ['red', 'green', 'blue', null]
 * // Type: (string | null)[] | undefined
 * ```
 * 
 * @example Number enum parsing
 * ```typescript
 * const result = parseEnum({
 *   value: {
 *     type: 'number',
 *     enum: [1, 2, 3, 5, 8, 13],
 *     description: 'Fibonacci subset'
 *   },
 *   nullable: false,
 *   valibotSchema: v.number(),
 *   context: parseContext
 * });
 * 
 * console.log(result.enum); // [1, 2, 3, 5, 8, 13]
 * ```
 * 
 * @example Invalid enum handling
 * ```typescript
 * const result = parseEnum({
 *   value: {
 *     type: 'number',
 *     enum: [1, 'invalid', 3], // Contains invalid value
 *     description: 'Mixed enum (invalid)'
 *   },
 *   nullable: false,
 *   valibotSchema: v.number(),
 *   context: parseContext
 * });
 * 
 * console.log(result.enum); // undefined (entire enum removed due to invalid value)
 * // Context will log a warning about the invalid enum
 * ```
 * 
 * @example Boolean enum (essentially optional boolean)
 * ```typescript
 * const result = parseEnum({
 *   value: {
 *     type: 'boolean',
 *     enum: [true, false],
 *     description: 'Explicit boolean enum'
 *   },
 *   nullable: false,
 *   valibotSchema: v.boolean(),
 *   context: parseContext
 * });
 * 
 * console.log(result.enum); // [true, false]
 * ```
 */
export const parseEnum = <
  T,
  Nullable extends boolean | undefined,
  Value extends OpenAPIV3.SchemaObject
>({
  value,
  nullable,
  valibotSchema,
  context
}: ParseEnumArgs<T, Nullable, Value>): ParseEnumReturn<T, Nullable, Value> => {
  const { enum: enums, ...rest } = value

  const parsedEnum = context.provisionalParse({
    key: 'enum',
    value: enums,
    parent: value,
    schema: nullable === true ? v.array(v.nullable(valibotSchema)) : v.array(valibotSchema),
    toMessage: value => `Removed invalid enum. Expected ${valibotSchema.type}, got: ${value}`,
    type: 'INVALID_ENUM'
  })

  return {
    enum: parsedEnum,
    value: rest
  } as ParseEnumReturn<T, Nullable, Value>
}
