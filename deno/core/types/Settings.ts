import { type Method, method } from './Method.ts'
import { z } from 'npm:zod@3.24.1'

export const operationsGeneratorSettings = z.object({
  id: z.string(),
  description: z.string().optional(),
  operations: z.record(z.record(method, z.boolean()))
})

export type OperationsGeneratorSettings = {
  id: string
  description?: string
  operations: Record<string, Partial<Record<Method, boolean>>>
}

export const modelsGeneratorSettings = z.object({
  id: z.string(),
  exportPath: z.string().optional(),
  description: z.string().optional(),
  models: z.record(z.boolean())
})

export type ModelsGeneratorSettings = {
  id: string
  exportPath?: string
  description?: string
  models: Record<string, boolean>
}

export const clientGeneratorSettings = z.union([
  operationsGeneratorSettings,
  modelsGeneratorSettings
])

export type ClientGeneratorSettings = OperationsGeneratorSettings | ModelsGeneratorSettings

export const modulePackage = z.object({
  rootPath: z.string(),
  moduleName: z.string()
})

export type ModulePackage = {
  rootPath: string
  moduleName: string
}

export const clientSettings = z.object({
  basePath: z.string().optional(),
  packages: z.array(modulePackage).optional(),
  generators: z.array(clientGeneratorSettings)
})

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

export const skmtcClientConfig: z.ZodType<SkmtcClientConfig> = z.object({
  serverName: z.string().optional(),
  stackName: z.string().optional(),
  deploymentId: z.string().optional(),
  settings: clientSettings
})

export const generatorType = z.enum(['operation', 'model'])

export type GeneratorType = 'operation' | 'model'

export const skmtcStackConfig = z.object({
  name: z.string().optional(),
  version: z.string().optional(),
  generators: z.array(z.string())
})

export type SkmtcStackConfig = {
  name?: string
  version?: string
  generators: string[]
}
