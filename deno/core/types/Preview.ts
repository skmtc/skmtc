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

/**
 * Valibot schema for validating operation source objects.
 * 
 * Validates operation source structures including type, generator ID,
 * operation path, and HTTP method information.
 */
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

/**
 * Valibot schema for validating model source objects.
 * 
 * Validates model source structures including type, generator ID,
 * and reference name information.
 */
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

/**
 * Valibot schema for validating preview group values.
 * 
 * Validates preview group categories for UI organization.
 */
export const previewGroup: v.GenericSchema<PreviewGroup> = v.picklist(['forms', 'tables', 'inputs'])

/**
 * Valibot schema for validating preview module objects.
 * 
 * Validates preview module structures including group, title, and description.
 */
export const previewModule: v.GenericSchema<PreviewModule> = v.object({
  name: v.string(),
  exportPath: v.string(),
  group: previewGroup
})

/**
 * Valibot schema for validating mapping module objects.
 * 
 * Validates mapping module structures for file relationship tracking.
 */
export const mappingModule: v.GenericSchema<MappingModule> = v.object({
  name: v.string(),
  exportPath: v.string(),
  group: previewGroup,
  itemType: v.picklist(['input', 'formatter']),
  schema: v.string()
})

const source: v.VariantSchema<'type', [typeof operationSource, typeof modelSource], undefined> =
  v.variant('type', [operationSource, modelSource])

/**
 * Valibot schema for validating preview objects.
 * 
 * Validates complete preview structures including module and source information.
 */
export const preview: v.GenericSchema<Preview> = v.object({
  module: previewModule,
  source: source
})

/**
 * Valibot schema for validating mapping objects.
 * 
 * Validates complete mapping structures including module and source information.
 */
export const mapping: v.GenericSchema<Mapping> = v.object({
  module: mappingModule,
  source: source
})
