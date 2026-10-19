import type { Method } from '@/types/Method.ts'

/**
 * A path item field that holds an Operation Object in OpenAPI 3.0. A
 * `query` key is not one of them: it stays a skipped field.
 */
export type PathItemMethod = Exclude<Method, 'query'>

export const pathItemMethods: readonly PathItemMethod[] = [
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace'
]

/**
 * Returns `key` as a {@link PathItemMethod} when it is one of {@link pathItemMethods}.
 */
export const toPathItemMethod = (key: string): PathItemMethod | undefined => {
  return pathItemMethods.find(method => method === key)
}
