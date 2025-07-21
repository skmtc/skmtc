// @deno-types="npm:@types/lodash-es@4.17.12"
import { camelCase } from 'npm:lodash-es@4.17.21'
import type { OasOperation } from '../oas/operation/Operation.ts'
import type { Method } from '../types/Method.ts'
import { match } from 'npm:ts-pattern@5.7.1'

export const toEndpointType = (operation: OasOperation): 'query' | 'mutation' => {
  return operation.method === 'get' ? 'query' : 'mutation'
}

/** generates endpoint name in the `camelCase{method}Api{path}` format */
export const toEndpointName = (operation: OasOperation): string => {
  const { path, method } = operation

  const verb = toMethodVerb(method)

  return camelCase(`${verb}Api${path}`)
}

export const toResponseName = (operation: OasOperation): string => {
  const operationName = toEndpointName(operation)

  return `${operationName}Response`
}

export const toArgsName = (operation: OasOperation): string => {
  const operationName = toEndpointName(operation)

  return `${operationName}Args`
}

export const toMethodVerb = (method: Method): string => {
  return match(method)
    .with('post', () => 'Create')
    .with('put', () => 'Update')
    .otherwise(matched => matched)
}
