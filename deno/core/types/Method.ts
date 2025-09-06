import * as v from 'valibot'

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

export const methodValuesNoTrace = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch']

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

export type Method = 'get' | 'put' | 'post' | 'delete' | 'options' | 'head' | 'patch' | 'trace'

type Methods = Method[]

export const methods: v.ArraySchema<typeof method, undefined> = v.array(method)

export const isMethod = (arg: unknown): arg is Method => {
  return v.safeParse(method, arg).success
}
