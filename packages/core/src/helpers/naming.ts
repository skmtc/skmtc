
import { camelCase } from 'lodash-es'
import type { OasOperation } from '../oas/operation/Operation.js'
import type { Method } from '../types/Method.js'
import { match } from 'ts-pattern'

export const toEndpointType = (
  operation: OasOperation
): 'query' | 'mutation' => {
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
