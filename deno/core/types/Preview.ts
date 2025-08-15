import { method, type Method } from './Method.ts'
import * as v from 'valibot'

export type OperationSource = {
  type: 'operation'
  generatorId: string
  operationPath: string
  operationMethod: Method
}

export type ModelSource = {
  type: 'model'
  generatorId: string
  refName: string
}

export type PreviewGroup = 'forms' | 'tables' | 'inputs'

export type PreviewModule = {
  name: string
  exportPath: string
  group: PreviewGroup
}

export type MappingModule = {
  name: string
  exportPath: string
  group: PreviewGroup
  itemType: 'input' | 'formatter'
  schema: string
}

export type Preview = {
  module: PreviewModule
  source: OperationSource | ModelSource
}

export type Mapping = {
  module: MappingModule
  source: OperationSource | ModelSource
}

export const operationSource = v.object({
  type: v.literal('operation'),
  generatorId: v.string(),
  operationPath: v.string(),
  operationMethod: method
})

export const modelSource = v.object({
  type: v.literal('model'),
  generatorId: v.string(),
  refName: v.string()
})

export const previewGroup = v.picklist(['forms', 'tables', 'inputs'])

export const previewModule = v.object({
  name: v.string(),
  exportPath: v.string(),
  group: previewGroup
})

export const mappingModule = v.object({
  name: v.string(),
  exportPath: v.string(),
  group: previewGroup,
  itemType: v.picklist(['input', 'formatter']),
  schema: v.string()
})

export const preview = v.object({
  module: previewModule,
  source: v.variant('type', [operationSource, modelSource])
})

export const mapping = v.object({
  module: mappingModule,
  source: v.variant('type', [operationSource, modelSource])
})
