import { generatorEnrichments, type GeneratorEnrichments } from './Enrichments.ts'
import * as v from 'valibot'
import { method, type Method } from './Method.ts'

export const modulePackage = v.object({
  rootPath: v.string(),
  moduleName: v.optional(v.string())
})

export type ModulePackage = {
  rootPath: string
  moduleName?: string
}

export const skipPaths = v.record(v.string(), v.array(method))

export const skipOperations = v.record(v.string(), skipPaths)

export const skipModels = v.record(v.string(), v.array(v.string()))

const skip = v.union([skipOperations, skipModels, v.string()])

export const clientSettings = v.object({
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
  deploymentId?: string
  serverName?: string
  serverOrigin?: string
  settings: ClientSettings
}

export const skmtcClientConfig = v.object({
  deploymentId: v.optional(v.string()),
  serverName: v.optional(v.string()),
  serverOrigin: v.optional(v.string()),
  settings: clientSettings
})
