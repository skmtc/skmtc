/**
 * @fileoverview SKMTC Core Settings and Configuration
 * 
 * This module provides comprehensive configuration types and schemas for the SKMTC
 * code generation pipeline. It defines settings for generators, modules, packages,
 * and runtime behavior that control how OpenAPI documents are processed and what
 * artifacts are generated.
 * 
 * ## Key Features
 * 
 * - **Generator Configuration**: Settings for individual code generators
 * - **Module Management**: Package and module resolution configuration
 * - **Runtime Settings**: Control generation behavior and output preferences
 * - **Enrichment Integration**: Support for UI enrichment metadata
 * - **Type Safety**: Comprehensive Valibot validation for all configuration
 * 
 * @example Basic generator settings
 * ```typescript
 * import type { Settings } from '@skmtc/core/Settings';
 * 
 * const settings: Settings = {
 *   generators: {
 *     'my-generator': {
 *       enabled: true,
 *       config: {
 *         outputPath: './generated',
 *         typescript: true
 *       }
 *     }
 *   },
 *   enrichments: {},
 *   filters: {
 *     includePaths: ['/api/v1/*'],
 *     excludeMethods: ['OPTIONS']
 *   }
 * };
 * ```
 * 
 * @example Module package configuration
 * ```typescript
 * import type { ModulePackage } from '@skmtc/core/Settings';
 * 
 * const moduleConfig: ModulePackage = {
 *   rootPath: './src/generated',
 *   moduleName: '@my-org/api-client'
 * };
 * ```
 * 
 * @module Settings
 */

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

/**
 * Valibot schema for validating skip paths configuration.
 * 
 * Validates path-to-methods mappings for skipping specific operations.
 */
export const skipPaths: v.GenericSchema<SkipPaths> = v.record(v.string(), v.array(method))

/**
 * Valibot schema for validating skip operations configuration.
 * 
 * Validates generator-to-skip-paths mappings for skipping operations by generator.
 */
export const skipOperations: v.GenericSchema<SkipOperations> = v.record(v.string(), skipPaths)

/**
 * Valibot schema for validating skip models configuration.
 * 
 * Validates generator-to-model-names mappings for skipping specific models.
 */
export const skipModels: v.GenericSchema<SkipModels> = v.record(v.string(), v.array(v.string()))

const skip: v.GenericSchema<Skip> = v.union([skipOperations, skipModels, v.string()])

/**
 * Valibot schema for validating client settings configuration.
 * 
 * Validates the complete client settings structure including base paths,
 * packages, skip configurations, and enrichments.
 */
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

/**
 * Configuration for SKMTC client with optional project identification.
 * 
 * Extends client settings with an optional project key for multi-project
 * environments or organizational contexts.
 */
export type SkmtcClientConfig = {
  /** Optional project identifier for organizational contexts */
  projectKey?: string
  /** Client settings for customizing generation behavior */
  settings: ClientSettings
}

/**
 * Valibot schema for validating SKMTC client configuration.
 * 
 * Validates the complete client configuration including project key
 * and client settings structure.
 */
export const skmtcClientConfig: v.GenericSchema<SkmtcClientConfig> = v.object({
  projectKey: v.optional(v.string()),
  settings: clientSettings
})
