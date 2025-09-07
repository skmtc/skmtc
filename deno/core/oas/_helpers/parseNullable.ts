import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContext } from '../../context/ParseContext.ts'
import * as v from 'valibot'

/**
 * Arguments for parsing the nullable property from OpenAPI schemas.
 * 
 * @template Value - The OpenAPI schema object type
 */
export type ParseNullableArgs<Value extends OpenAPIV3.SchemaObject> = {
  /** The OpenAPI schema object containing the nullable property */
  value: Value
  /** Parse context for error handling */
  context: ParseContext
}

/**
 * Return type for parsed nullable data.
 * 
 * @template Value - The OpenAPI schema object type
 */
export type ParseNullableReturn<Value extends OpenAPIV3.SchemaObject> = {
  /** The validated nullable flag (true, false, or undefined) */
  nullable: boolean | undefined
  /** The schema object without the nullable property */
  value: Omit<Value, 'nullable'>
}

/**
 * Parses and validates the nullable property from OpenAPI schema objects.
 * 
 * This function extracts and validates the `nullable` property from OpenAPI
 * schema objects, ensuring it's a valid boolean value. Invalid nullable values
 * are removed and logged as warnings through the parse context.
 * 
 * The nullable property determines whether a schema value can be null in addition
 * to its primary type, which affects type generation and validation logic.
 * 
 * @template Value - The OpenAPI schema object type
 * 
 * @param args - Parsing configuration
 * @returns Parsed nullable data with the validated flag and cleaned schema
 * 
 * @example Valid nullable property
 * ```typescript
 * import { parseNullable } from '@skmtc/core/oas/_helpers';
 * 
 * const result = parseNullable({
 *   value: {
 *     type: 'string',
 *     nullable: true,
 *     description: 'An optional string that can be null'
 *   },
 *   context: parseContext
 * });
 * 
 * console.log(result.nullable); // true
 * console.log(result.value);    // { type: 'string', description: 'An optional string that can be null' }
 * ```
 * 
 * @example Explicitly non-nullable
 * ```typescript
 * const result = parseNullable({
 *   value: {
 *     type: 'number',
 *     nullable: false,
 *     minimum: 0
 *   },
 *   context: parseContext
 * });
 * 
 * console.log(result.nullable); // false
 * console.log(result.value);    // { type: 'number', minimum: 0 }
 * ```
 * 
 * @example Missing nullable property (undefined)
 * ```typescript
 * const result = parseNullable({
 *   value: {
 *     type: 'string',
 *     format: 'email'
 *   },
 *   context: parseContext
 * });
 * 
 * console.log(result.nullable); // undefined (property not present)
 * console.log(result.value);    // { type: 'string', format: 'email' }
 * ```
 * 
 * @example Invalid nullable value
 * ```typescript
 * const result = parseNullable({
 *   value: {
 *     type: 'boolean',
 *     nullable: 'yes', // Invalid - should be boolean
 *     description: 'A flag'
 *   } as any,
 *   context: parseContext
 * });
 * 
 * console.log(result.nullable); // undefined (invalid value removed)
 * console.log(result.value);    // { type: 'boolean', description: 'A flag' }
 * // Context will log a warning about the invalid nullable value
 * ```
 * 
 * @example Usage in type generation
 * ```typescript
 * function generateTypeScript(schema: OpenAPIV3.SchemaObject) {
 *   const { nullable, value } = parseNullable({ value: schema, context });
 *   
 *   const baseType = generateBaseType(value);
 *   const nullableType = nullable ? ` | null` : '';
 *   
 *   return `${baseType}${nullableType}`;
 * }
 * 
 * // Examples:
 * // nullable: true  -> 'string | null'
 * // nullable: false -> 'string'
 * // nullable: undefined -> 'string' (default behavior)
 * ```
 * 
 * @example Complex schema with nullable
 * ```typescript
 * const result = parseNullable({
 *   value: {
 *     type: 'object',
 *     properties: {
 *       name: { type: 'string' },
 *       age: { type: 'number' }
 *     },
 *     required: ['name'],
 *     nullable: true // The entire object can be null
 *   },
 *   context: parseContext
 * });
 * 
 * console.log(result.nullable); // true
 * // Generated type might be: { name: string; age?: number } | null
 * ```
 */
export const parseNullable = <Value extends OpenAPIV3.SchemaObject>({
  value,
  context
}: ParseNullableArgs<Value>): ParseNullableReturn<Value> => {
  const { nullable, ...rest } = value

  const parsedNullable = context.provisionalParse({
    key: 'nullable',
    value: nullable,
    parent: value,
    schema: v.optional(v.boolean()),
    toMessage: (input: unknown) => `Invalid nullable: ${input}`,
    type: 'INVALID_NULLABLE'
  })

  return {
    nullable: parsedNullable,
    value: rest
  }
}
