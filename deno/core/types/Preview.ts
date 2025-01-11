import { z } from 'zod'
import { method, type Method } from './Method.ts'

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
  source: OperationPreview | ModelPreview
}

const operationPreview = z.object({
  type: z.literal('operation'),
  generatorId: z.string(),
  operationPath: z.string(),
  operationMethod: method
})

const modelPreview = z.object({
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
    source: z.discriminatedUnion('type', [operationPreview, modelPreview])
  })
  .openapi('Preview')
