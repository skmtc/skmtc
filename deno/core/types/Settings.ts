import { generatorEnrichments, type GeneratorEnrichments } from './Enrichments.ts'
import * as v from 'valibot'
import { method, type Method } from './Method.ts'

export const modulePackage: v.GenericSchema<ModulePackage> = v.object({
  rootPath: v.string(),
  moduleName: v.optional(v.string())
})

export type ModulePackage = {
  rootPath: string
  moduleName?: string
}

export const skipPaths: v.GenericSchema<SkipPaths> = v.record(v.string(), v.array(method))

export const skipOperations: v.GenericSchema<SkipOperations> = v.record(v.string(), skipPaths)

export const skipModels: v.GenericSchema<SkipModels> = v.record(v.string(), v.array(v.string()))

const skip: v.GenericSchema<Skip> = v.union([skipOperations, skipModels, v.string()])

export const clientSettings: v.GenericSchema<ClientSettings> = v.object({
  basePath: v.optional(v.string()),
  packages: v.optional(v.array(modulePackage)),
  enrichments: v.optional(generatorEnrichments),
  skip: v.optional(v.array(skip))
})

export type SkipPaths = Record<string, Method[]>

export type SkipModels = Record<string, string[]>

export type SkipOperations = Record<string, SkipPaths>

export type Skip = SkipOperations | SkipModels | string

export type ClientSettings = {
  basePath?: string
  packages?: ModulePackage[]
  enrichments?: GeneratorEnrichments
  skip?: Skip[]
}

export type SkmtcClientConfig = {
  projectKey?: string
  settings: ClientSettings
}

export const skmtcClientConfig: v.GenericSchema<SkmtcClientConfig> = v.object({
  projectKey: v.optional(v.string()),
  settings: clientSettings
})
