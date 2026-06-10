import type { OasOperationConfig } from '@/dsl/operation/oas/types.ts'
import type { GqlOperationConfig } from '@/dsl/operation/gql/types.ts'
import type { ModelConfig } from '@/dsl/model/types.ts'

/**
 * Discriminated union of every generator configuration the dispatcher
 * recognizes. The `type` field discriminates the variant — `'oasOperation'`
 * for HTTP-flavored operation generators, `'gqlOperation'` for GraphQL
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
 *   transform: ({ context, operation }) => {},
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
 *   transform: ({ context, operation }) => {}
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
 *   transform: ({ context, refName }) => {}
 * });
 * // modelEntry.type === 'model'
 * ```
 */
export type GeneratorConfig<EnrichmentType = undefined> =
  | OasOperationConfig<EnrichmentType>
  | GqlOperationConfig<EnrichmentType>
  | ModelConfig<EnrichmentType>

/**
 * A name → generator-config map. Keys are arbitrary generator
 * identifiers (the same string a caller might pass to `--skip` etc.);
 * each value is a `GeneratorConfig` variant.
 *
 * The runtime treats this as a plain `Record<string, GeneratorConfig>`
 * — it iterates with `Object.values` and `Object.keys` — so the type
 * mirrors that shape. There is no per-key type narrowing: callers who
 * want type-level distinctions between specific entries can keep the
 * literal map well-typed at its definition site and only widen here at
 * the boundary.
 */
export type GeneratorsMapContainer<EnrichmentType = undefined> = Record<
  string,
  GeneratorConfig<EnrichmentType>
>
