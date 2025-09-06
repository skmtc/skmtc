import { generatorEnrichments, type GeneratorEnrichments } from './Enrichments.ts'
import * as v from 'valibot'
import { method, type Method } from './Method.ts'

/**
 * Valibot schema for {@link ModulePackage}.
 */
export const modulePackage: v.GenericSchema<ModulePackage> = v.object({
  rootPath: v.string(),
  moduleName: v.optional(v.string())
})

/**
 * Configuration for a module package in the generation output.
 * 
 * Module packages allow organizing generated code into separate npm packages
 * or modules with custom root paths and naming conventions.
 * 
 * @example
 * ```typescript
 * const packages: ModulePackage[] = [
 *   {
 *     rootPath: './packages/api-client',
 *     moduleName: '@myorg/api-client'
 *   },
 *   {
 *     rootPath: './packages/types',
 *     moduleName: '@myorg/api-types'  
 *   }
 * ];
 * ```
 */
export type ModulePackage = {
  /** The root file system path for this package */
  rootPath: string
  /** Optional module name for package.json or imports */
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

/**
 * Configuration for skipping specific HTTP methods on API paths.
 * 
 * Maps path patterns to arrays of HTTP methods that should be excluded
 * from generation.
 * 
 * @example
 * ```typescript
 * const skipPaths: SkipPaths = {
 *   '/admin/**': ['get', 'post'],
 *   '/debug': ['*']  // Skip all methods
 * };
 * ```
 */
export type SkipPaths = Record<string, Method[]>

/**
 * Configuration for skipping model generation by generator type.
 * 
 * Maps generator keys to arrays of model names that should be excluded.
 * 
 * @example
 * ```typescript
 * const skipModels: SkipModels = {
 *   'typescript-models': ['InternalModel', 'DebugInfo'],
 *   'validation': ['TempModel*']  // Supports glob patterns
 * };
 * ```
 */
export type SkipModels = Record<string, string[]>

/**
 * Configuration for skipping operation generation by generator type.
 * 
 * Maps generator keys to {@link SkipPaths} configurations for excluding
 * specific operations from generation.
 * 
 * @example
 * ```typescript
 * const skipOperations: SkipOperations = {
 *   'api-client': {
 *     '/internal/**': ['*'],
 *     '/admin': ['delete']
 *   }
 * };
 * ```
 */
export type SkipOperations = Record<string, SkipPaths>

/**
 * Union type representing different skip configurations.
 * 
 * Can be either operation-specific skipping, model-specific skipping,
 * or a simple string pattern for broad exclusions.
 */
export type Skip = SkipOperations | SkipModels | string

/**
 * Main configuration object for SKMTC client settings.
 * 
 * Controls various aspects of code generation including output paths,
 * package organization, enrichments, and selective skipping of content.
 * 
 * @example Basic configuration
 * ```typescript
 * const settings: ClientSettings = {
 *   basePath: './src/generated',
 *   skip: [
 *     'InternalModel',  // Skip specific model
 *     {
 *       'api-client': {
 *         '/admin/**': ['*']  // Skip all admin operations  
 *       }
 *     }
 *   ]
 * };
 * ```
 * 
 * @example Advanced configuration with packages
 * ```typescript
 * const settings: ClientSettings = {
 *   basePath: './generated',
 *   packages: [
 *     {
 *       rootPath: './packages/client',
 *       moduleName: '@company/api-client'
 *     },
 *     {
 *       rootPath: './packages/types', 
 *       moduleName: '@company/api-types'
 *     }
 *   ],
 *   enrichments: {
 *     models: customModelEnrichments,
 *     operations: customOperationEnrichments
 *   },
 *   skip: [
 *     {
 *       'models': ['Internal*', 'Debug*'],
 *       'operations': {
 *         '/health': ['get'],
 *         '/metrics/**': ['*']
 *       }
 *     }
 *   ]
 * };
 * ```
 */
export type ClientSettings = {
  /** Base output path for generated files */
  basePath?: string
  /** Array of module package configurations */
  packages?: ModulePackage[]
  /** Custom enrichments for extending generation */
  enrichments?: GeneratorEnrichments
  /** Array of skip configurations to exclude content */
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
