import { type Method, method } from './Method.ts'
import * as v from 'valibot'

export const enrichedSetting = v.object({
  selected: v.boolean(),
  enrichments: v.optional(v.unknown())
})

export type EnrichedSetting = {
  selected: boolean
  enrichments?: unknown
}

export const operationsGeneratorSettings = v.object({
  id: v.string(),
  description: v.optional(v.string()),
  operations: v.record(v.string(), v.record(method, enrichedSetting))
})

export type OperationsGeneratorSettings = {
  id: string
  description?: string
  operations: Record<string, Partial<Record<Method, EnrichedSetting>>>
}

export const modelsGeneratorSettings = v.object({
  id: v.string(),
  exportPath: v.optional(v.string()),
  description: v.optional(v.string()),
  models: v.record(v.string(), enrichedSetting)
})

export type ModelsGeneratorSettings = {
  id: string
  exportPath?: string
  description?: string
  models: Record<string, EnrichedSetting>
}

export const clientGeneratorSettings = v.union([
  operationsGeneratorSettings,
  modelsGeneratorSettings
])

export type ClientGeneratorSettings = OperationsGeneratorSettings | ModelsGeneratorSettings

export const modulePackage = v.object({
  rootPath: v.string(),
  moduleName: v.optional(v.string())
})

export type ModulePackage = {
  rootPath: string
  moduleName?: string
}

export const clientSettings = v.object({
  basePath: v.optional(v.string()),
  packages: v.optional(v.array(modulePackage)),
  generators: v.array(clientGeneratorSettings)
})

export type ClientSettings = {
  basePath?: string
  packages?: ModulePackage[]
  generators: ClientGeneratorSettings[]
}

export type SkmtcClientConfig = {
  accountName?: string
  deploymentId?: string
  settings: ClientSettings
}

export const skmtcClientConfig = v.object({
  accountName: v.optional(v.string()),
  deploymentId: v.optional(v.string()),
  settings: clientSettings
})

export const skmtcStackConfig = v.object({
  name: v.optional(v.string()),
  version: v.optional(v.string()),
  generators: v.array(v.string())
})

export type SkmtcStackConfig = {
  name?: string
  version?: string
  generators: string[]
}
