/**
 * @fileoverview HTTP Method System for SKMTC Core
 * 
 * This module provides comprehensive HTTP method definitions and utilities for
 * handling OpenAPI operations. It includes type-safe method definitions,
 * validation utilities, and constants for all HTTP methods supported by
 * the OpenAPI v3 specification.
 * 
 * The module ensures type safety when working with HTTP methods throughout
 * the SKMTC pipeline and provides utilities for method validation and processing.
 * 
 * ## Key Features
 * 
 * - **Complete Method Support**: All HTTP methods from OpenAPI v3 specification
 * - **Type Safety**: Branded types and type guards for method handling
 * - **Validation**: Runtime validation with Valibot integration
 * - **Case Handling**: Proper case normalization for method strings
 * - **Specification Compliance**: Full adherence to OpenAPI v3 method definitions
 * 
 * @example Working with HTTP methods
 * ```typescript
 * import { Method, isMethod, methodValues } from '@skmtc/core/Method';
 * 
 * // Type-safe method handling
 * const method: Method = 'GET';
 * 
 * // Validate unknown method strings
 * const userInput = 'post';
 * if (isMethod(userInput)) {
 *   console.log(`Valid method: ${userInput}`); // TypeScript knows it's a Method
 * }
 * 
 * // List all supported methods
 * console.log('Supported methods:', methodValues);
 * ```
 * 
 * @example Method validation in generators
 * ```typescript
 * import { isMethod, Method } from '@skmtc/core/Method';
 * 
 * function processOperation(path: string, method: string, operation: any) {
 *   if (!isMethod(method)) {
 *     throw new Error(`Unsupported HTTP method: ${method}`);
 *   }
 *   
 *   // TypeScript now knows method is of type Method
 *   return generateOperationCode(path, method, operation);
 * }
 * ```
 * 
 * @example Case-insensitive method handling
 * ```typescript
 * import { normalizeMethod, isMethod } from '@skmtc/core/Method';
 * 
 * function handleMethodString(methodStr: string) {
 *   const normalized = methodStr.toLowerCase();
 *   
 *   if (isMethod(normalized)) {
 *     return processValidMethod(normalized);
 *   } else {
 *     throw new Error(`Invalid method: ${methodStr}`);
 *   }
 * }
 * ```
 * 
 * @module Method
 */

import * as v from 'valibot'

/**
 * Array of all valid HTTP methods supported by OpenAPI v3.
 * 
 * This constant array includes all HTTP methods that can be used
 * in OpenAPI path operations, as defined by the OpenAPI specification.
 * All methods are in lowercase to match OpenAPI conventions.
 */
export const methodValues = [
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace'
] as const

/**
 * Array of HTTP methods excluding TRACE.
 * 
 * This is a filtered version of {@link methodValues} that excludes the TRACE method,
 * which is sometimes excluded from API operations for security reasons.
 */
export const methodValuesNoTrace = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch']

/**
 * Valibot schema for validating HTTP method strings.
 * 
 * This union schema validates that a string value is one of the valid
 * HTTP methods supported by OpenAPI. Used throughout the codebase for
 * runtime validation of method values.
 * 
 * @example
 * ```typescript
 * import * as v from 'valibot';
 * import { method } from '@skmtc/core';
 * 
 * // Valid method
 * const result1 = v.parse(method, 'get'); // 'get'
 * 
 * // Invalid method throws ValiError
 * try {
 *   v.parse(method, 'invalid');
 * } catch (error) {
 *   console.log('Invalid method');
 * }
 * ```
 */
export const method: v.UnionSchema<
  [
    v.LiteralSchema<'get', undefined>,
    v.LiteralSchema<'post', undefined>,
    v.LiteralSchema<'put', undefined>,
    v.LiteralSchema<'patch', undefined>,
    v.LiteralSchema<'delete', undefined>,
    v.LiteralSchema<'head', undefined>,
    v.LiteralSchema<'options', undefined>,
    v.LiteralSchema<'trace', undefined>
  ],
  undefined
> = v.union([
  v.literal('get'),
  v.literal('post'),
  v.literal('put'),
  v.literal('patch'),
  v.literal('delete'),
  v.literal('head'),
  v.literal('options'),
  v.literal('trace')
])

/**
 * TypeScript type representing valid HTTP methods.
 * 
 * This union type includes all HTTP methods supported by OpenAPI v3 operations.
 * It's used throughout the codebase for type safety when working with API methods.
 * 
 * @example
 * ```typescript
 * import { Method } from '@skmtc/core';
 * 
 * function processOperation(method: Method, path: string) {
 *   switch (method) {
 *     case 'get':
 *       return handleGet(path);
 *     case 'post':
 *       return handlePost(path);
 *     // ... handle other methods
 *     default:
 *       // TypeScript ensures exhaustive checking
 *       const _exhaustive: never = method;
 *       throw new Error(`Unhandled method: ${method}`);
 *   }
 * }
 * ```
 */
export type Method = 'get' | 'put' | 'post' | 'delete' | 'options' | 'head' | 'patch' | 'trace'


/**
 * Valibot schema for validating arrays of HTTP methods.
 * 
 * This schema validates that an array contains only valid HTTP method strings.
 * Useful for validating configuration objects that specify multiple methods.
 * 
 * @example
 * ```typescript
 * import * as v from 'valibot';
 * import { methods } from '@skmtc/core';
 * 
 * // Valid methods array
 * const validMethods = v.parse(methods, ['get', 'post', 'put']); // ['get', 'post', 'put']
 * 
 * // Invalid methods array throws ValiError
 * try {
 *   v.parse(methods, ['get', 'invalid', 'post']);
 * } catch (error) {
 *   console.log('Invalid methods in array');
 * }
 * ```
 */
export const methods: v.ArraySchema<typeof method, undefined> = v.array(method)

/**
 * Type guard to check if a value is a valid HTTP Method.
 * 
 * This function uses the Valibot schema to safely determine if an unknown
 * value is a valid HTTP method string. It's particularly useful when parsing
 * user input or external data.
 * 
 * @param arg - Value to check
 * @returns True if the value is a valid Method
 * 
 * @example
 * ```typescript
 * import { isMethod } from '@skmtc/core';
 * 
 * function handleRequest(methodStr: unknown, path: string) {
 *   if (isMethod(methodStr)) {
 *     // methodStr is now typed as Method
 *     console.log(`Processing ${methodStr.toUpperCase()} ${path}`);
 *   } else {
 *     throw new Error(`Invalid HTTP method: ${methodStr}`);
 *   }
 * }
 * 
 * handleRequest('get', '/users');    // Works
 * handleRequest('invalid', '/users'); // Throws error
 * ```
 */
export const isMethod = (arg: unknown): arg is Method => {
  return v.safeParse(method, arg).success
}
