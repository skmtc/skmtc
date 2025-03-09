import { z } from '@hono/zod-openapi'
import { method, type Method } from './Method.ts'
import type { OasSchema } from '../oas/schema/Schema.ts'

export type InputOption = {
  schema: OasSchema
  label: string
  name?: string
}

export const inputOption = z.object({
  schema: z.record(z.unknown()),
  label: z.string(),
  name: z.string().optional()
})

export type FormatterOption = {
  schema: OasSchema
  label: string
}

export const formatterOption = z.object({
  schema: z.record(z.unknown()),
  label: z.string()
})

export type OperationPreview = {
  type: 'operation'
  generatorId: string
  operationPath: string
  operationMethod: Method
}

export type ModelPreview = {
  type: 'model'
  generatorId: string
  refName: string
}

export type Preview = {
  name: string
  route?: string
  exportPath: string
  group: string
  input?: InputOption
  formatter?: FormatterOption
  source: OperationPreview | ModelPreview
}

export const operationPreview = z.object({
  type: z.literal('operation'),
  generatorId: z.string(),
  operationPath: z.string(),
  operationMethod: method
})

export const modelPreview = z.object({
  type: z.literal('model'),
  generatorId: z.string(),
  refName: z.string()
})

export const preview = z
  .object({
    name: z.string(),
    exportPath: z.string(),
    group: z.string(),
    route: z.string().optional(),
    input: inputOption.optional(),
    formatter: formatterOption.optional(),
    source: z.discriminatedUnion('type', [operationPreview, modelPreview])
  })
  .openapi('Preview')
