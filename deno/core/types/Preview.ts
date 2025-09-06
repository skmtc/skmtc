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

export const operationSource: v.ObjectSchema<
  {
    readonly type: v.LiteralSchema<'operation', undefined>
    readonly generatorId: v.StringSchema<undefined>
    readonly operationPath: v.StringSchema<undefined>
    readonly operationMethod: v.UnionSchema<
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
    >
  },
  undefined
> = v.object({
  type: v.literal('operation'),
  generatorId: v.string(),
  operationPath: v.string(),
  operationMethod: method
})

export const modelSource: v.ObjectSchema<
  {
    readonly type: v.LiteralSchema<'model', undefined>
    readonly generatorId: v.StringSchema<undefined>
    readonly refName: v.StringSchema<undefined>
  },
  undefined
> = v.object({
  type: v.literal('model'),
  generatorId: v.string(),
  refName: v.string()
})

export const previewGroup: v.GenericSchema<PreviewGroup> = v.picklist(['forms', 'tables', 'inputs'])

export const previewModule: v.GenericSchema<PreviewModule> = v.object({
  name: v.string(),
  exportPath: v.string(),
  group: previewGroup
})

export const mappingModule: v.GenericSchema<MappingModule> = v.object({
  name: v.string(),
  exportPath: v.string(),
  group: previewGroup,
  itemType: v.picklist(['input', 'formatter']),
  schema: v.string()
})

const source: v.VariantSchema<'type', [typeof operationSource, typeof modelSource], undefined> =
  v.variant('type', [operationSource, modelSource])

export const preview: v.GenericSchema<Preview> = v.object({
  module: previewModule,
  source: source
})

export const mapping: v.GenericSchema<Mapping> = v.object({
  module: mappingModule,
  source: source
})
