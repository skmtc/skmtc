import * as v from 'valibot'

/**
 * Array of all valid HTTP methods supported by OpenAPI v3.
 *
 * This constant array includes all HTTP methods that can be used
 * in OpenAPI path operations, as defined by the OpenAPI specification.
 * All methods are in lowercase to match OpenAPI conventions. `query` is
 * an OpenAPI 3.2 method; each parser tree reads its own list from
 * `parse/v3-X/methods.ts`.
 */
export const methodValues = [
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
  'query'
] as const

/**
 * Array of HTTP methods excluding TRACE.
 *
 * This is a filtered version of {@link methodValues} that excludes the TRACE method,
 * which is sometimes excluded from API operations for security reasons.
 */
export const methodValuesNoTrace = [
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'query'
]

export const method: v.UnionSchema<
  [
    v.LiteralSchema<'get', undefined>,
    v.LiteralSchema<'post', undefined>,
    v.LiteralSchema<'put', undefined>,
    v.LiteralSchema<'patch', undefined>,
    v.LiteralSchema<'delete', undefined>,
    v.LiteralSchema<'head', undefined>,
    v.LiteralSchema<'options', undefined>,
    v.LiteralSchema<'trace', undefined>,
    v.LiteralSchema<'query', undefined>
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
  v.literal('trace'),
  v.literal('query')
])

export type Method =
  | 'get'
  | 'put'
  | 'post'
  | 'delete'
  | 'options'
  | 'head'
  | 'patch'
  | 'trace'
  | 'query'

export const methods: v.ArraySchema<typeof method, undefined> = v.array(method)

export const isMethod = (arg: unknown): arg is Method => {
  return v.is(method, arg)
}
