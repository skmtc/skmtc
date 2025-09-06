import type { OperationConfig } from '../dsl/operation/types.ts'
import type { ModelConfig } from '../dsl/model/types.ts'

/**
 * Union type representing all possible generator configurations.
 * 
 * Generator configurations define how different types of generators should
 * process OpenAPI documents. This includes both operation generators (which
 * process API endpoints) and model generators (which process data schemas).
 * 
 * @template EnrichmentType - Optional type for custom enrichment data
 * 
 * @example
 * ```typescript
 * import { GeneratorConfig } from '@skmtc/core';
 * 
 * // Operation generator configuration
 * const apiClientConfig: GeneratorConfig = {
 *   type: 'operation',
 *   generatorId: 'api-client',
 *   settings: {
 *     exportPath: './src/api/client.ts',
 *     enrichment: customEnrichments
 *   },
 *   toGenerator: (args) => new ApiClientGenerator(args)
 * };
 * 
 * // Model generator configuration
 * const typescriptModels: GeneratorConfig = {
 *   type: 'model', 
 *   generatorId: 'typescript-models',
 *   settings: {
 *     exportPath: './src/types/models.ts'
 *   },
 *   toGenerator: (args) => new TypeScriptModelGenerator(args)
 * };
 * ```
 */
export type GeneratorConfig<EnrichmentType = undefined> =
  | OperationConfig<EnrichmentType>
  | ModelConfig<EnrichmentType>

/**
 * Type-safe mapping of generator configurations.
 * 
 * This type preserves the structure and types of generator configurations
 * within a map, ensuring that each generator maintains its specific
 * configuration type and enrichment data.
 * 
 * @template G - The generator configuration type
 * @template EnrichmentType - The enrichment type for the generators
 * 
 * @example
 * ```typescript
 * type MyGenerators = {
 *   'api-client': OperationConfig<ApiEnrichment>;
 *   'typescript-models': ModelConfig<ModelEnrichment>;
 *   'validation': ModelConfig<ValidationEnrichment>;
 * };
 * 
 * type MyGeneratorsMap = GeneratorsMap<MyGenerators, undefined>;
 * // Preserves the exact structure and types of MyGenerators
 * ```
 */
export type GeneratorsMap<G extends GeneratorConfig<EnrichmentType>, EnrichmentType> = {
  [K in keyof G]: G[K]
}

/**
 * Container type for a complete generators map with optional enrichment.
 * 
 * This type represents a complete mapping of generators that can process
 * an OpenAPI document. It's used as the main configuration structure
 * passed to the SKMTC processing pipeline.
 * 
 * @template EnrichmentType - Optional type for custom enrichment data across all generators
 * 
 * @example Basic generators map
 * ```typescript
 * import { GeneratorsMapContainer } from '@skmtc/core';
 * 
 * const generators: GeneratorsMapContainer = {
 *   'api-client': {
 *     type: 'operation',
 *     generatorId: 'api-client',
 *     settings: { exportPath: './src/api.ts' },
 *     toGenerator: (args) => new ApiClientGenerator(args)
 *   },
 *   'typescript-models': {
 *     type: 'model',
 *     generatorId: 'typescript-models', 
 *     settings: { exportPath: './src/models.ts' },
 *     toGenerator: (args) => new TypeScriptModels(args)
 *   }
 * };
 * 
 * // Use with toArtifacts
 * const result = await toArtifacts({
 *   documentObject: openApiDoc,
 *   settings: clientSettings,
 *   toGeneratorConfigMap: () => generators,
 *   traceId: 'generation',
 *   spanId: 'main',
 *   startAt: Date.now()
 * });
 * ```
 * 
 * @example With enrichments
 * ```typescript
 * type MyEnrichments = {
 *   customValidation: boolean;
 *   generateComments: boolean;
 * };
 * 
 * const enrichedGenerators: GeneratorsMapContainer<MyEnrichments> = {
 *   'enhanced-models': {
 *     type: 'model',
 *     generatorId: 'enhanced-models',
 *     settings: {
 *       exportPath: './src/enhanced.ts',
 *       enrichment: {
 *         customValidation: true,
 *         generateComments: true
 *       }
 *     },
 *     toGenerator: (args) => new EnhancedModelGenerator(args)
 *   }
 * };
 * ```
 */
export type GeneratorsMapContainer<EnrichmentType = undefined> = GeneratorsMap<
  GeneratorConfig<EnrichmentType>,
  EnrichmentType
>
