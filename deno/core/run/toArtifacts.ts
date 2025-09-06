import type { ClientSettings } from '../types/Settings.ts'
import type { PrettierConfigType } from '../types/PrettierConfig.ts'
import { CoreContext } from '../context/CoreContext.ts'
import type { ManifestContent } from '../types/Manifest.ts'
import type { GeneratorsMapContainer } from '../types/GeneratorType.ts'
import type { OpenAPIV3 } from 'openapi-types'

/**
 * Arguments for the {@link toArtifacts} transformation function.
 * 
 * @example
 * ```typescript
 * const args: TransformArgs = {
 *   traceId: 'api-generation-v1',
 *   spanId: 'user-api-span',
 *   documentObject: openApiDocument,
 *   settings: {
 *     basePath: './generated',
 *     skip: { models: ['InternalModel'] }
 *   },
 *   toGeneratorConfigMap: () => myGeneratorMap,
 *   startAt: Date.now(),
 *   silent: false
 * };
 * ```
 */
type TransformArgs = {
  /** Unique identifier for the transformation trace */
  traceId: string
  /** Unique identifier for this transformation span */
  spanId: string
  /** The OpenAPI v3 document to process */
  documentObject: OpenAPIV3.Document
  /** Client settings for customizing generation behavior */
  settings: ClientSettings | undefined
  /** Optional Prettier configuration for code formatting */
  prettier?: PrettierConfigType
  /** Optional path for writing log files */
  logsPath?: string
  /** Function that returns the generator configuration map */
  toGeneratorConfigMap: <EnrichmentType = undefined>() => GeneratorsMapContainer<EnrichmentType>
  /** Timestamp when transformation started */
  startAt: number
  /** Whether to suppress console output during generation */
  silent: boolean
}

/**
 * Transforms an OpenAPI v3 document into generated code artifacts and metadata.
 * 
 * This is the primary function for the SKMTC transformation pipeline. It orchestrates
 * the three-phase process of parsing OpenAPI documents, generating code artifacts,
 * and rendering them to formatted files.
 * 
 * The function creates a {@link CoreContext} instance and executes the full pipeline:
 * 1. **Parse**: Converts the OpenAPI document into internal OAS objects
 * 2. **Generate**: Transforms OAS objects using the provided generator configuration
 * 3. **Render**: Formats and prepares the final code artifacts
 * 
 * @param args - Configuration for the transformation process
 * @returns A promise resolving to the generated artifacts and manifest
 * 
 * @example Basic usage
 * ```typescript
 * import { toArtifacts } from '@skmtc/core';
 * 
 * const result = await toArtifacts({
 *   traceId: 'my-api-generation',
 *   spanId: 'user-service',
 *   documentObject: myOpenApiDoc,
 *   settings: {
 *     basePath: './src/generated',
 *     skip: {
 *       models: ['InternalModel', 'DebugInfo'],
 *       operations: {
 *         '/internal/**': ['get', 'post']
 *       }
 *     }
 *   },
 *   toGeneratorConfigMap: () => ({
 *     models: modelGenerator,
 *     operations: operationGenerator
 *   }),
 *   startAt: Date.now(),
 *   silent: false
 * });
 * 
 * // Access generated files
 * Object.entries(result.artifacts).forEach(([path, content]) => {
 *   console.log(`Generated: ${path}`);
 *   await Deno.writeTextFile(path, content);
 * });
 * 
 * // Access generation metadata
 * console.log(`Generated ${Object.keys(result.manifest.files).length} files`);
 * console.log(`Generation took ${result.manifest.endAt - result.manifest.startAt}ms`);
 * ```
 * 
 * @example With Prettier formatting
 * ```typescript
 * const result = await toArtifacts({
 *   traceId: 'formatted-generation',
 *   spanId: 'api-client',
 *   documentObject: openApiDoc,
 *   settings: clientSettings,
 *   prettier: {
 *     semi: true,
 *     singleQuote: true,
 *     trailingComma: 'es5'
 *   },
 *   toGeneratorConfigMap: () => generatorMap,
 *   startAt: Date.now(),
 *   silent: true
 * });
 * ```
 * 
 * @example Error handling
 * ```typescript
 * try {
 *   const result = await toArtifacts(transformArgs);
 *   
 *   // Check for generation errors in the results
 *   const hasErrors = Object.values(result.manifest.results)
 *     .some(result => result === 'error');
 *   
 *   if (hasErrors) {
 *     console.warn('Generation completed with errors');
 *   }
 * } catch (error) {
 *   console.error('Transformation failed:', error);
 * }
 * ```
 */
export const toArtifacts = async ({
  traceId,
  spanId,
  documentObject,
  settings,
  prettier,
  toGeneratorConfigMap,
  logsPath,
  startAt,
  silent
}: TransformArgs): Promise<{ artifacts: Record<string, string>; manifest: ManifestContent }> => {
  const context = new CoreContext({ spanId, logsPath, silent })

  const { artifacts, files, previews, results, mappings } = await context.toArtifacts({
    settings,
    toGeneratorConfigMap,
    prettier,
    documentObject,
    silent
  })

  const manifest: ManifestContent = {
    files,
    previews,
    mappings,
    traceId,
    spanId,
    results,
    deploymentId: Deno.env.get('DENO_DEPLOYMENT_ID') ?? Date.now().toString(),
    region: Deno.env.get('DENO_REGION'),
    startAt,
    endAt: Date.now()
  }

  return { artifacts, manifest }
}
