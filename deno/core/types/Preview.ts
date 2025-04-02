import { method, type Method } from './Method.ts'
import type { OasSchema } from '../oas/schema/Schema.ts'
import * as v from 'valibot'

/** @deprecated */
export type InputOption = {
  schema: OasSchema
  label: string
  name?: string
}

/** @deprecated */
export const inputOption = v.object({
  schema: v.record(v.string(), v.unknown()),
  label: v.string(),
  name: v.optional(v.string())
})

/** @deprecated */
export type FormatterOption = {
  schema: OasSchema
  label: string
}

/** @deprecated */
export const formatterOption = v.object({
  schema: v.record(v.string(), v.unknown()),
  label: v.string()
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
  /** @deprecated */
  route?: string
  exportPath: string
  group: string
  /** @deprecated */
  input?: InputOption
  /** @deprecated */
  formatter?: FormatterOption
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
  /** @deprecated */
  route: v.optional(v.string()),
  /** @deprecated */
  input: v.optional(inputOption),
  /** @deprecated */
  formatter: v.optional(formatterOption),
  source: v.variant('type', [operationPreview, modelPreview])
})
