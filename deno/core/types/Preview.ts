import { method, type Method } from './Method.ts'
import * as v from 'valibot'

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
  exportPath: string
  group: string
  source: OperationPreview | ModelPreview
}

export const operationPreview = v.object({
  type: v.literal('operation'),
  generatorId: v.string(),
  operationPath: v.string(),
  operationMethod: method
})

export const modelPreview = v.object({
  type: v.literal('model'),
  generatorId: v.string(),
  refName: v.string()
})

export const preview = v.object({
  name: v.string(),
  exportPath: v.string(),
  group: v.string(),
  source: v.variant('type', [operationPreview, modelPreview])
})
