import type { OpenAPIV3 } from 'openapi-types'
import type { Method } from '@/types/Method.ts'

/**
 * The path item fields that hold an Operation Object in OpenAPI 3.2.
 * `query` is new in 3.2.
 */
export const pathItemMethods: readonly Method[] = [
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
  'query'
]

/**
 * A 3.2 path item: the `openapi-types` path item plus the `query` operation.
 */
export type PathItemObjectV3 = OpenAPIV3.PathItemObject & {
  query?: OpenAPIV3.OperationObject
}

/**
 * Returns `key` as a {@link Method} when it is one of {@link pathItemMethods}.
 */
export const toPathItemMethod = (key: string): Method | undefined => {
  return pathItemMethods.find(method => method === key)
}
