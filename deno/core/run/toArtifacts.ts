import type { ClientSettings } from '../types/Settings.ts'
import { CoreContext } from '../context/CoreContext.ts'
import type { ManifestContent } from '../types/Manifest.ts'
import type { GeneratorsMapContainer } from '../types/GeneratorType.ts'
import type { StackTrail } from '../context/StackTrail.ts'
import type { SkmtcDocumentInput } from '../types/SkmtcDocument.ts'
import type { AttributionState } from '../types/AttributionState.ts'
import type { Sidecar } from '../anchors/sidecar.ts'
import type { GenerationMapEntry } from '../anchors/generationMap.ts'

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
  /**
   * Source document. Discriminated union: an OpenAPI v3 document
   * (`{ type: 'oas', value }`) or a GraphQL SDL string / `GraphQLSchema`
   * (`{ type: 'gql', value }`). Protocol-specific parsing runs inside
   * the pipeline.
   */
  document: SkmtcDocumentInput
  /** Client settings for customizing generation behavior */
  settings: ClientSettings | undefined
  /** Optional path for writing log files */
  logsPath?: string
  /** Stack trail for distributed tracing */
  stackTrail: StackTrail
  /** Function that returns the generator configuration map */
  toGeneratorConfigMap: <EnrichmentType = undefined>() => GeneratorsMapContainer<EnrichmentType>
  /** Timestamp when transformation started */
  startAt: number
  /** Whether to suppress console output during generation */
  silent: boolean
  /**
   * Optional attribution (gen-maps) state. When set with a
   * `postPass` block, the pipeline emits sidecars + a generation-map index
   * alongside the standard artifacts. See {@link AttributionState}.
   */
  attribution?: AttributionState
  /**
   * When `true`, the result carries an `inspection` snapshot — a cycle-safe,
   * depth-bounded JSON serialization of the live `inspectedFiles` graph. Opt-in;
   * the generate/render pipeline is unaffected.
   */
  inspect?: boolean
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
export const toArtifacts = ({
  traceId,
  spanId,
  document,
  settings,
  toGeneratorConfigMap,
  logsPath,
  startAt,
  silent,
  stackTrail,
  attribution,
  inspect
}: TransformArgs): {
  artifacts: Record<string, string>
  manifest: ManifestContent
  sidecars?: Record<string, Sidecar>
  generationMap?: GenerationMapEntry[]
  inspection?: unknown
} => {
  const context = new CoreContext({ spanId, logsPath, silent })

  const {
    artifacts,
    files,
    previews,
    results,
    mappings,
    parseIssues,
    sidecars,
    generationMap,
    inspection
  } = context.toArtifacts({
    settings,
    toGeneratorConfigMap,
    document,
    stackTrail,
    silent,
    attribution,
    inspect
  })

  const manifest: ManifestContent = {
    files,
    previews,
    mappings,
    traceId,
    spanId,
    results,
    parseIssues,
    deploymentId: Date.now().toString(),
    region: undefined,
    startAt,
    endAt: Date.now()
  }

  return { artifacts, manifest, sidecars, generationMap, inspection }
}
