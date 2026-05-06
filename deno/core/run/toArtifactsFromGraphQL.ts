import type { ClientSettings } from '@/types/Settings.ts'
import type { PrettierConfigType } from '@/types/PrettierConfig.ts'
import { CoreContext } from '@/context/CoreContext.ts'
import type { ManifestContent } from '@/types/Manifest.ts'
import type { GeneratorsMapContainer } from '@/types/GeneratorType.ts'
import type { StackTrail } from '@/context/StackTrail.ts'
import type { GqlDocument } from '@/gql/document/GqlDocument.ts'
import type { GraphQLSchema } from 'graphql'
import { toGqlDocument } from '@/parsers/graphql/toGqlDocument.ts'
import { GqlParseContext, type GqlParseIssue } from '@/gql/parse/GqlParseContext.ts'

/**
 * Arguments for {@link toArtifactsFromGraphQL}.
 *
 * Mirrors the OpenAPI-flavoured `TransformArgs` from `toArtifacts`, but
 * accepts a GraphQL source. The `source` may be:
 * - an SDL string (most common — typically read from a `.graphql` file)
 * - a pre-built `GqlDocument` (already parsed via `toGqlDocument`)
 * - a `graphql-js` `GraphQLSchema` instance (parsed by `toGqlDocument`)
 */
export type TransformGraphQLArgs = {
  /** Unique identifier for the transformation trace */
  traceId: string
  /** Unique identifier for this transformation span */
  spanId: string
  /**
   * The GraphQL source. SDL string, parsed `GqlDocument`, or
   * `graphql-js` `GraphQLSchema`. Strings and `GraphQLSchema`
   * instances are routed through {@link toGqlDocument}; existing
   * `GqlDocument`s pass straight through.
   */
  source: string | GraphQLSchema | GqlDocument
  /** Client settings for customizing generation behavior */
  settings: ClientSettings | undefined
  /** Optional Prettier configuration for code formatting */
  prettier?: PrettierConfigType
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
}

/**
 * Type guard distinguishing a pre-built `GqlDocument` from raw inputs.
 */
const isGqlDocument = (
  source: string | GraphQLSchema | GqlDocument
): source is GqlDocument => {
  return (
    typeof source === 'object' &&
    source !== null &&
    (source as { oasType?: string }).oasType === 'gqlDocument'
  )
}

/**
 * Transforms a GraphQL schema into generated code artifacts and metadata.
 *
 * Sibling to {@link toArtifacts}: same pipeline, same generators (model
 * generators are protocol-neutral; operation generators marked
 * `protocol: 'gql'` run; HTTP-protocol operation generators are skipped).
 * The only difference is the input — this entry parses GraphQL SDL or
 * accepts a pre-built `GqlDocument`, then hands a `SkmtcDocument` to
 * `CoreContext.toArtifacts` for the generate and render phases.
 *
 * @example
 * ```typescript
 * const result = toArtifactsFromGraphQL({
 *   traceId: 'gql-gen',
 *   spanId: 'main',
 *   source: await Deno.readTextFile('./schema.graphql'),
 *   settings: { basePath: './generated' },
 *   toGeneratorConfigMap: () => generatorMap,
 *   startAt: Date.now(),
 *   silent: false,
 *   stackTrail: new StackTrail(['gql'])
 * })
 * ```
 */
export const toArtifactsFromGraphQL = ({
  traceId,
  spanId,
  source,
  settings,
  prettier,
  toGeneratorConfigMap,
  logsPath,
  startAt,
  silent,
  stackTrail
}: TransformGraphQLArgs): {
  artifacts: Record<string, string>
  manifest: ManifestContent
  parseIssues: GqlParseIssue[]
} => {
  const context = new CoreContext({ spanId, logsPath, silent })

  // Construct a parse context so mapping-time issues surface in the
  // result instead of being silently dropped. When `silent` is false
  // the context also mirrors each issue to `console.warn` as it's
  // recorded — useful for long CLI runs.
  const parseContext = new GqlParseContext({ silent })
  const gqlDocument: GqlDocument = isGqlDocument(source)
    ? source
    : toGqlDocument(source, {}, parseContext)

  const { artifacts, files, previews, results, mappings } = context.toArtifacts({
    settings,
    toGeneratorConfigMap,
    prettier,
    document: { type: 'gql', value: gqlDocument },
    stackTrail,
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

  return { artifacts, manifest, parseIssues: parseContext.issues }
}
