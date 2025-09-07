import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContext } from '../../context/ParseContext.ts'
import * as v from 'valibot'

/**
 * Arguments for parsing OpenAPI schema default values.
 * 
 * @template T - The expected type of the default value
 * @template Nullable - Whether the schema allows null values
 * @template Value - The OpenAPI schema object type
 */
type ParseDefaultArgs<
  T,
  Nullable extends boolean | undefined,
  Value extends OpenAPIV3.SchemaObject
> = {
  /** The OpenAPI schema object without nullable, example, and enum properties */
  value: Omit<Value, 'nullable' | 'example' | 'enum'>
  /** Whether the schema allows null values */
  nullable: Nullable
  /** Valibot schema for validating the default value */
  valibotSchema: v.GenericSchema<T>
  /** Parse context for error handling */
  context: ParseContext
}

/**
 * Return type for parsed default value data.
 * 
 * @template T - The expected type of the default value
 * @template Nullable - Whether the schema allows null values
 * @template Value - The OpenAPI schema object type
 */
type ParseDefaultReturn<
  T,
  Nullable extends boolean | undefined,
  Value extends OpenAPIV3.SchemaObject
> = {
  /** The parsed and validated default value */
  default: Nullable extends true ? T | null | undefined : T | undefined
  /** The schema object with all processed properties removed */
  value: Omit<Value, 'nullable' | 'example' | 'enum' | 'default'>
}

/**
 * Parses and validates OpenAPI schema default values with type safety.
 * 
 * This function extracts and validates default values from OpenAPI schema objects,
 * ensuring they conform to the expected type and handling nullable schemas correctly.
 * Invalid default values are removed and logged as warnings through the parse context.
 * 
 * The function provides full type safety, with the return type reflecting whether
 * null values are allowed based on the nullable parameter. This ensures that
 * generated code maintains proper type constraints for default values.
 * 
 * @template T - The expected type of the default value
 * @template Nullable - Whether the schema allows null as a default
 * @template Value - The OpenAPI schema object type
 * 
 * @param args - Parsing configuration
 * @returns Parsed default data with the validated default value and cleaned schema
 * 
 * @example Basic string default parsing
 * ```typescript
 * import { parseDefault } from '@skmtc/core/oas/_helpers';
 * import * as v from 'valibot';
 * 
 * const result = parseDefault({
 *   value: {
 *     type: 'string',
 *     default: 'hello world',
 *     minLength: 5
 *   },
 *   nullable: false,
 *   valibotSchema: v.string(),
 *   context: parseContext
 * });
 * 
 * console.log(result.default); // 'hello world'
 * console.log(result.value);   // { type: 'string', minLength: 5 }
 * ```
 * 
 * @example Nullable default value
 * ```typescript
 * const result = parseDefault({
 *   value: {
 *     type: 'string',
 *     default: null,
 *     format: 'email'
 *   },
 *   nullable: true,
 *   valibotSchema: v.string(),
 *   context: parseContext
 * });
 * 
 * console.log(result.default); // null (valid for nullable schema)
 * // Type: string | null | undefined
 * ```
 * 
 * @example Number default with constraints
 * ```typescript
 * const result = parseDefault({
 *   value: {
 *     type: 'number',
 *     default: 42,
 *     minimum: 0,
 *     maximum: 100
 *   },
 *   nullable: false,
 *   valibotSchema: v.number(),
 *   context: parseContext
 * });
 * 
 * console.log(result.default); // 42
 * console.log(result.value);   // { type: 'number', minimum: 0, maximum: 100 }
 * ```
 * 
 * @example Invalid default handling
 * ```typescript
 * const result = parseDefault({
 *   value: {
 *     type: 'boolean',
 *     default: 'not a boolean', // Invalid default
 *     description: 'A boolean flag'
 *   },
 *   nullable: false,
 *   valibotSchema: v.boolean(),
 *   context: parseContext
 * });
 * 
 * console.log(result.default); // undefined (invalid default removed)
 * // Context will log a warning about the invalid default
 * ```
 * 
 * @example Array default value
 * ```typescript
 * const result = parseDefault({
 *   value: {
 *     type: 'array',
 *     items: { type: 'string' },
 *     default: ['item1', 'item2']
 *   },
 *   nullable: false,
 *   valibotSchema: v.array(v.string()),
 *   context: parseContext
 * });
 * 
 * console.log(result.default); // ['item1', 'item2']
 * ```
 * 
 * @example Object default value
 * ```typescript
 * const result = parseDefault({
 *   value: {
 *     type: 'object',
 *     properties: {
 *       name: { type: 'string' },
 *       age: { type: 'number' }
 *     },
 *     default: { name: 'John', age: 30 }
 *   },
 *   nullable: false,
 *   valibotSchema: v.object({
 *     name: v.string(),
 *     age: v.number()
 *   }),
 *   context: parseContext
 * });
 * 
 * console.log(result.default); // { name: 'John', age: 30 }
 * ```
 */
export const parseDefault = <
  T,
  Nullable extends boolean | undefined,
  Value extends OpenAPIV3.SchemaObject
>({
  value,
  nullable,
  valibotSchema,
  context
}: ParseDefaultArgs<T, Nullable, Value>): ParseDefaultReturn<T, Nullable, Value> => {
  const { default: defaultValue, ...rest } = value

  const parsedDefault = context.provisionalParse({
    key: 'default',
    value: defaultValue,
    parent: value,
    schema: nullable === true ? v.nullable(valibotSchema) : valibotSchema,
    toMessage: value => `Removed invalid default. Expected ${valibotSchema.type}, got: ${value}`,
    type: 'INVALID_DEFAULT'
  })

  return {
    default: parsedDefault,
    value: rest
  } as ParseDefaultReturn<T, Nullable, Value>
}
