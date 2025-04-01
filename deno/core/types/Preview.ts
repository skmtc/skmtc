import { z } from 'zod'
import { method, type Method } from './Method.ts'
import type { OasSchema } from '../oas/schema/Schema.ts'

/** @deprecated */
export type InputOption = {
  schema: OasSchema
  label: string
  name?: string
}

/** @deprecated */
export const inputOption = z.object({
  schema: z.record(z.unknown()),
  label: z.string(),
  name: z.string().optional()
})

/** @deprecated */
export type FormatterOption = {
  schema: OasSchema
  label: string
}

/** @deprecated */
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

export const preview = z.object({
  name: z.string(),
  exportPath: z.string(),
  group: z.string(),
  /** @deprecated */
  route: z.string().optional(),
  /** @deprecated */
  input: inputOption.optional(),
  /** @deprecated */
  formatter: formatterOption.optional(),
  source: z.discriminatedUnion('type', [operationPreview, modelPreview])
})
