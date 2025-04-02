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

export const method = v.union([
  v.literal('get'),
  v.literal('put'),
  v.literal('post'),
  v.literal('delete'),
  v.literal('options'),
  v.literal('head'),
  v.literal('patch')
])

export type Method = 'get' | 'put' | 'post' | 'delete' | 'options' | 'head' | 'patch' | 'trace'

type Methods = Method[]

export const methods = v.array(method)

export const isMethod = (arg: unknown): arg is Method => {
  return v.safeParse(method, arg).success
}
