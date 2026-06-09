import type { GqlOperation } from '@/gql/operation/GqlOperation.ts'
import type { Lang } from '@/dsl/Lang.ts'
import type { ContentSettings } from '@/dsl/ContentSettings.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import type { Identifier } from '@/dsl/Identifier.ts'
import type { GeneratedValue } from '@/dsl/GeneratedValue.ts'
import type { EnrichmentRequest } from '@/types/EnrichmentRequest.ts'
import type * as v from 'valibot'
import type { MappingModule, PreviewModule } from '@/types/Preview.ts'

/**
 * External constructor signature for a GraphQL operation projection class.
 *
 * The pipeline calls `new SomeProjection(args)` with this shape; the
 * runtime base class injects `generatorKey` before calling `super()`.
 */
export type GqlOperationProjectionConstructorArgs<EnrichmentType = undefined> = {
  context: GenerateContextType
  settings: ContentSettings<EnrichmentType>
  operation: GqlOperation
}

export type TransformGqlOperationArgs<Acc> = {
  context: GenerateContextType
  operation: GqlOperation
  acc: Acc | undefined
  /**
   * The operation variant the engine is dispatching for this call. The
   * engine fans out one `transform` call per variant declared in the
   * consumer's `enrichments[id][rootKind][fieldName]` block (or just
   * `'main'` when no enrichments are configured). See {@link Variant}.
   */
  variant: string
}

export type WithTransformGqlOperation = {
  transformOperation: (operation: GqlOperation) => void
}

export type IsSupportedGqlOperationConfigArgs<EnrichmentType = undefined> = {
  context: GenerateContextType
  operation: GqlOperation
  enrichments: EnrichmentType
  /** Operation variant being probed (see {@link Variant}) */
  variant: string
}

export type IsSupportedGqlOperationArgs = {
  context: GenerateContextType
  operation: GqlOperation
  /** Operation variant being probed (see {@link Variant}) */
  variant: string
}

export type ToGqlOperationEnrichmentsArgs = {
  operation: GqlOperation
  context: GenerateContextType
  /** Operation variant whose enrichment should be resolved (see {@link Variant}) */
  variant: string
}

export type ToGqlOperationPreviewModuleArgs = {
  context: GenerateContextType
  operation: GqlOperation
  /** Operation variant the preview module describes (see {@link Variant}) */
  variant: string
}

export type ToGqlOperationMappingArgs = {
  context: GenerateContextType
  operation: GqlOperation
  /** Operation variant the mapping module describes (see {@link Variant}) */
  variant: string
}

/**
 * Static structural type of a GraphQL operation projection class.
 *
 * Captures both the instance side (`new(...) => V`) and the static side
 * (`id`, `toIdentifier`, `toExportPath`, `toEnrichments`). Passed as a
 * type parameter to `context.insertOperation(...)`.
 */
export type ToGqlOperationIdentifierArgs<EnrichmentType = undefined> = {
  operation: GqlOperation
  enrichments: EnrichmentType
  /** Operation variant the identifier should disambiguate (see {@link Variant}) */
  variant: string
}

export type ToGqlOperationExportPathArgs<EnrichmentType = undefined> = {
  operation: GqlOperation
  enrichments: EnrichmentType
  /** Operation variant the export path should disambiguate (see {@link Variant}) */
  variant: string
}

export type GqlOperationProjection<V extends GeneratedValue, EnrichmentType = undefined> = {
  prototype: V
} & {
  new ({
    context,
    settings,
    operation
  }: GqlOperationProjectionConstructorArgs<EnrichmentType>): V
  id: string
  type: 'gqlOperation'
  toIdentifier: (args: ToGqlOperationIdentifierArgs<EnrichmentType>) => Identifier
  toExportPath: (args: ToGqlOperationExportPathArgs<EnrichmentType>) => string
  toEnrichments: ({ operation, context }: ToGqlOperationEnrichmentsArgs) => EnrichmentType
  /**
   * Family-level capability predicate, surfaced as a static by
   * `toGqlOperationProjectionBase` (default `() => true`). The Driver
   * probes it on every `insertOperation` so a peer is never handed an
   * operation it has declared unsupported. Optional: a hand-rolled
   * projection may omit it, in which case it is treated as supporting
   * every operation.
   */
  isSupported?: (args: { operation: GqlOperation; context: GenerateContextType }) => boolean
  // deno-lint-ignore ban-types
} & Function

/**
 * Pipeline-side configuration for a GraphQL operation projection (built by
 * `toGqlOperationEntry`).
 */
export type GqlOperationConfig<EnrichmentType = undefined> = {
  id: string
  type: 'gqlOperation'
  /** The target language. Resolved by the engine via `context.resolveLang(id)`. */
  lang: Lang
  transform: <Acc = void>({ context, operation, acc }: TransformGqlOperationArgs<Acc>) => Acc
  toEnrichmentSchema?: () => v.GenericSchema<EnrichmentType>
  isSupported: ({ context, operation }: IsSupportedGqlOperationArgs) => boolean
  toPreviewModule?: ({ context, operation }: ToGqlOperationPreviewModuleArgs) => PreviewModule
  toMappingModule?: ({ context, operation }: ToGqlOperationMappingArgs) => MappingModule
  toEnrichmentRequest?: <RequestedEnrichment extends EnrichmentType>(
    operation: GqlOperation
  ) => EnrichmentRequest<RequestedEnrichment> | undefined
}
