// @deno-types="npm:@types/lodash-es@4.17.12"
import { camelCase } from 'npm:lodash-es@4.17.21'
import type { OasOperation } from '../oas/operation/Operation.ts'
import type { Method } from '../types/Method.ts'
import { match } from 'npm:ts-pattern@^5.8.0'

/**
 * Determines the endpoint type based on HTTP method.
 * 
 * @param operation - The OpenAPI operation to analyze
 * @returns 'query' for GET operations, 'mutation' for all others
 * 
 * @example
 * ```typescript
 * const getOp = new OasOperation({ method: 'get', path: '/users' });
 * console.log(toEndpointType(getOp)); // 'query'
 * 
 * const postOp = new OasOperation({ method: 'post', path: '/users' });
 * console.log(toEndpointType(postOp)); // 'mutation'
 * ```
 */
export const toEndpointType = (operation: OasOperation): 'query' | 'mutation' => {
  return operation.method === 'get' ? 'query' : 'mutation'
}

/**
 * Generates endpoint name in the `camelCase{method}Api{path}` format.
 * 
 * @param operation - The OpenAPI operation
 * @returns Camel-cased endpoint name
 * 
 * @example
 * ```typescript
 * const op = new OasOperation({ method: 'post', path: '/users/{id}/profile' });
 * console.log(toEndpointName(op)); // 'createApiUsersIdProfile'
 * ```
 */
export const toEndpointName = (operation: OasOperation): string => {
  const { path, method } = operation

  const verb = toMethodVerb(method)

  return camelCase(`${verb}Api${path}`)
}

/**
 * Generates response type name for an operation.
 * 
 * @param operation - The OpenAPI operation
 * @returns Response type name with 'Response' suffix
 * 
 * @example
 * ```typescript
 * const op = new OasOperation({ method: 'get', path: '/users' });
 * console.log(toResponseName(op)); // 'getApiUsersResponse'
 * ```
 */
export const toResponseName = (operation: OasOperation): string => {
  const operationName = toEndpointName(operation)

  return `${operationName}Response`
}

/**
 * Generates arguments type name for an operation.
 * 
 * @param operation - The OpenAPI operation
 * @returns Arguments type name with 'Args' suffix
 * 
 * @example
 * ```typescript
 * const op = new OasOperation({ method: 'put', path: '/users/{id}' });
 * console.log(toArgsName(op)); // 'updateApiUsersIdArgs'
 * ```
 */
export const toArgsName = (operation: OasOperation): string => {
  const operationName = toEndpointName(operation)

  return `${operationName}Args`
}

/**
 * Converts HTTP method to a descriptive verb.
 * 
 * @param method - HTTP method
 * @returns Descriptive verb for the method
 * 
 * @example
 * ```typescript
 * console.log(toMethodVerb('post')); // 'Create'
 * console.log(toMethodVerb('put'));  // 'Update'
 * console.log(toMethodVerb('get'));  // 'get'
 * console.log(toMethodVerb('delete')); // 'delete'
 * ```
 */
export const toMethodVerb = (method: Method): string => {
  return match(method)
    .with('post', () => 'Create')
    .with('put', () => 'Update')
    .otherwise(matched => matched)
}
