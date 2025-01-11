import "../_dnt.polyfills.js";
import { type Method, method } from './Method.js'
import { z } from 'zod'

export const enrichedSetting = z
  .object({
    selected: z.boolean(),
    enrichments: z.unknown().optional()
  })
  .openapi('EnrichedSetting')

export type EnrichedSetting = {
  selected: boolean
  enrichments?: unknown
}

export const operationsGeneratorSettings = z
  .object({
    id: z.string(),
    description: z.string().optional(),
    operations: z.record(z.record(method, enrichedSetting))
  })
  .openapi('OperationsGeneratorSettings')

export type OperationsGeneratorSettings = {
  id: string
  description?: string
  operations: Record<string, Partial<Record<Method, EnrichedSetting>>>
}

export const modelsGeneratorSettings = z
  .object({
    id: z.string(),
    exportPath: z.string().optional(),
    description: z.string().optional(),
    models: z.record(enrichedSetting)
  })
  .openapi('ModelsGeneratorSettings')

export type ModelsGeneratorSettings = {
  id: string
  exportPath?: string
  description?: string
  models: Record<string, EnrichedSetting>
}

export const clientGeneratorSettings = z
  .union([operationsGeneratorSettings, modelsGeneratorSettings])
  .openapi('GeneratorSettings')

export type ClientGeneratorSettings = OperationsGeneratorSettings | ModelsGeneratorSettings

export const modulePackage = z
  .object({
    rootPath: z.string(),
    moduleName: z.string()
  })
  .openapi('ModulePackage')

export type ModulePackage = {
  rootPath: string
  moduleName: string
}

export const clientSettings = z
  .object({
    basePath: z.string().optional(),
    packages: z.array(modulePackage).optional().openapi('ModulePackages'),
    generators: z.array(clientGeneratorSettings)
  })
  .openapi('ClientSettings')

export type ClientSettings = {
  basePath?: string
  packages?: ModulePackage[]
  generators: ClientGeneratorSettings[]
}

export type SkmtcClientConfig = {
  serverName?: string
  stackName?: string
  deploymentId?: string
  settings: ClientSettings
}

export const skmtcClientConfig = z
  .object({
    serverName: z.string().optional(),
    stackName: z.string().optional(),
    deploymentId: z.string().optional(),
    settings: clientSettings
  })
  .openapi('SkmtcClientConfig')

export const skmtcStackConfig = z
  .object({
    name: z.string().optional(),
    version: z.string().optional(),
    generators: z.array(z.string())
  })
  .openapi('SkmtcStackConfig')

export type SkmtcStackConfig = {
  name?: string
  version?: string
  generators: string[]
}
