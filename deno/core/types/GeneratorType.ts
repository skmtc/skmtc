import type { OasOperationConfig } from '@/dsl/operation/oas/types.ts'
import type { GqlOperationConfig } from '@/dsl/operation/gql/types.ts'
import type { ModelConfig } from '@/dsl/model/types.ts'

/**
 * Discriminated union of every generator configuration the dispatcher
 * recognises. The `type` field discriminates the variant — `'oasOperation'`
 * for HTTP-flavoured operation generators, `'gqlOperation'` for GraphQL
 * operation generators, `'model'` for protocol-neutral model generators.
 *
 * Operation variants are routed only to the matching document protocol; a
 * `'oasOperation'` config is silently skipped on a GraphQL document and
 * vice versa. Model generators run against either protocol's registry.
 *
 * @template EnrichmentType - Optional type for custom enrichment data
 *
 * @example OAS operation generator
 * ```typescript
 * import { toOasOperationEntry } from '@skmtc/core';
 *
 * const apiClientEntry = toOasOperationEntry({
 *   id: 'api-client',
 *   transform: ({ context, operation, acc }) => acc,
 *   isSupported: ({ operation }) => operation.method === 'get'
 * });
 * // apiClientEntry.type === 'oasOperation'
 * ```
 *
 * @example GraphQL operation generator
 * ```typescript
 * import { toGqlOperationEntry } from '@skmtc/core';
 *
 * const gqlEntry = toGqlOperationEntry({
 *   id: 'gql-client',
 *   transform: ({ context, operation, acc }) => acc
 * });
 * // gqlEntry.type === 'gqlOperation'
 * ```
 *
 * @example Model generator
 * ```typescript
 * import { toModelEntry } from '@skmtc/core';
 *
 * const modelEntry = toModelEntry({
 *   id: 'typescript-models',
 *   transform: ({ context, refName, acc }) => acc
 * });
 * // modelEntry.type === 'model'
 * ```
 */
export type GeneratorConfig<EnrichmentType = undefined> =
  | OasOperationConfig<EnrichmentType>
  | GqlOperationConfig<EnrichmentType>
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
 * import { toArtifacts, toOasOperationEntry, toModelEntry, StackTrail } from '@skmtc/core';
 *
 * const generators = {
 *   'api-client': toOasOperationEntry({
 *     id: 'api-client',
 *     transform: ({ context, operation, acc }) => acc
 *   }),
 *   'typescript-models': toModelEntry({
 *     id: 'typescript-models',
 *     transform: ({ context, refName, acc }) => acc
 *   })
 * };
 *
 * const result = toArtifacts({
 *   documentObject: openApiDoc,
 *   settings: clientSettings,
 *   toGeneratorConfigMap: () => generators,
 *   traceId: 'generation',
 *   spanId: 'main',
 *   startAt: Date.now(),
 *   silent: false,
 *   stackTrail: new StackTrail(['gen'])
 * });
 * ```
 */
export type GeneratorsMapContainer<EnrichmentType = undefined> = GeneratorsMap<
  GeneratorConfig<EnrichmentType>,
  EnrichmentType
>
