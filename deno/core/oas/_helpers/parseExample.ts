import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContext } from '../../context/ParseContext.ts'
import * as v from 'valibot'

/**
 * Arguments for parsing OpenAPI schema examples.
 * 
 * @template T - The expected type of the example value
 * @template Nullable - Whether the schema allows null values
 * @template Value - The OpenAPI schema object type
 */
type ParseExampleArgs<
  T,
  Nullable extends boolean | undefined,
  Value extends OpenAPIV3.SchemaObject
> = {
  /** The OpenAPI schema object without nullable property */
  value: Omit<Value, 'nullable'>
  /** Whether the schema allows null values */
  nullable: Nullable
  /** Valibot schema for validating the example */
  valibotSchema: v.GenericSchema<T>
  /** Parse context for error handling */
  context: ParseContext
}

/**
 * Return type for parsed example data.
 * 
 * @template T - The expected type of the example value
 * @template Nullable - Whether the schema allows null values
 * @template Value - The OpenAPI schema object type
 */
type ParseExampleReturn<
  T,
  Nullable extends boolean | undefined,
  Value extends OpenAPIV3.SchemaObject
> = {
  /** The parsed and validated example value */
  example: Nullable extends true ? T | null | undefined : T | undefined
  /** The schema object without example and nullable properties */
  value: Omit<Value, 'nullable' | 'example'>
}

/**
 * Parses and validates OpenAPI schema examples with type safety.
 * 
 * This function extracts and validates example values from OpenAPI schema objects,
 * ensuring they conform to the expected type and handling nullable schemas correctly.
 * Invalid examples are removed and logged as warnings through the parse context.
 * 
 * The function provides full type safety, with the return type reflecting whether
 * null values are allowed based on the nullable parameter.
 * 
 * @template T - The expected type of the example value
 * @template Nullable - Whether the schema allows null values
 * @template Value - The OpenAPI schema object type
 * 
 * @param args - Parsing configuration
 * @returns Parsed example data with the validated example and cleaned schema
 * 
 * @example Basic string example parsing
 * ```typescript
 * import { parseExample } from '@skmtc/core/oas/_helpers';
 * import * as v from 'valibot';
 * 
 * const result = parseExample({
 *   value: {
 *     type: 'string',
 *     example: 'hello world',
 *     format: 'text'
 *   },
 *   nullable: false,
 *   valibotSchema: v.string(),
 *   context: parseContext
 * });
 * 
 * console.log(result.example); // 'hello world'
 * console.log(result.value);   // { type: 'string', format: 'text' }
 * ```
 * 
 * @example Nullable schema example
 * ```typescript
 * const result = parseExample({
 *   value: {
 *     type: 'string',
 *     example: null,
 *     minLength: 1
 *   },
 *   nullable: true,
 *   valibotSchema: v.string(),
 *   context: parseContext
 * });
 * 
 * console.log(result.example); // null (valid for nullable schema)
 * // Type: string | null | undefined
 * ```
 * 
 * @example Invalid example handling
 * ```typescript
 * const result = parseExample({
 *   value: {
 *     type: 'number',
 *     example: 'not a number', // Invalid example
 *     minimum: 0
 *   },
 *   nullable: false,
 *   valibotSchema: v.number(),
 *   context: parseContext
 * });
 * 
 * console.log(result.example); // undefined (invalid example removed)
 * // Context will log a warning about the invalid example
 * ```
 * 
 * @example Array example parsing
 * ```typescript
 * const result = parseExample({
 *   value: {
 *     type: 'array',
 *     items: { type: 'string' },
 *     example: ['item1', 'item2', 'item3']
 *   },
 *   nullable: false,
 *   valibotSchema: v.array(v.string()),
 *   context: parseContext
 * });
 * 
 * console.log(result.example); // ['item1', 'item2', 'item3']
 * ```
 */
export const parseExample = <
  T,
  Nullable extends boolean | undefined,
  Value extends OpenAPIV3.SchemaObject
>({
  value,
  nullable,
  valibotSchema,
  context
}: ParseExampleArgs<T, Nullable, Value>): ParseExampleReturn<T, Nullable, Value> => {
  const { example, ...rest } = value

  const parsedExample = context.provisionalParse({
    key: 'example',
    value: example,
    parent: value,
    schema: nullable === true ? v.nullable(valibotSchema) : valibotSchema,
    toMessage: value => `Removed invalid example. Expected ${valibotSchema.type}, got: ${value}`,
    type: 'INVALID_EXAMPLE'
  })

  return {
    example: parsedExample,
    value: rest
  } as ParseExampleReturn<T, Nullable, Value>
}
