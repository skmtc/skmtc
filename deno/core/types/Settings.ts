import { generatorEnrichments, type GeneratorEnrichments } from './Enrichments.ts'
import * as v from 'valibot'

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
  enrichments: v.optional(generatorEnrichments)
})

export type ClientSettings = {
  basePath?: string
  packages?: ModulePackage[]
  enrichments?: GeneratorEnrichments
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
