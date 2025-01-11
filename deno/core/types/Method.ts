import { z } from 'npm:zod@3.24.1'

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

export const method: z.ZodType<Method> = z
  .enum(['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'])
  .openapi('Method')

export type Method = 'get' | 'put' | 'post' | 'delete' | 'options' | 'head' | 'patch' | 'trace'

type Methods = Method[]

export const methods: z.ZodType<Methods> = z.array(method)

export const isMethod = (arg: unknown): arg is Method => {
  return method.safeParse(arg).success
}
