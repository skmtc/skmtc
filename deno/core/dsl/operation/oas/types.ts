import type { OasOperation } from '@/oas/operation/Operation.ts'
import type { Lang } from '@/dsl/Lang.ts'
import type { ContentSettings } from '@/dsl/ContentSettings.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import type { Identifier } from '@/dsl/Identifier.ts'
import type { GeneratedValue } from '@/dsl/GeneratedValue.ts'
import type { EnrichmentRequest } from '@/types/EnrichmentRequest.ts'
import type * as v from 'valibot'
import type { MappingModule, PreviewModule } from '@/types/Preview.ts'

/**
 * External constructor signature for an OAS operation projection class.
 *
 * The pipeline calls `new SomeProjection(args)` with this shape; the
 * runtime base class injects `generatorKey` before calling `super()`.
 */
export type OasOperationProjectionConstructorArgs<EnrichmentType = undefined> = {
  context: GenerateContextType
  settings: ContentSettings<EnrichmentType>
  operation: OasOperation
}

export type TransformOasOperationArgs = {
  context: GenerateContextType
  operation: OasOperation
  /**
   * The operation variant the engine is dispatching for this call. The
   * engine fans out one `transform` call per variant declared in the
   * consumer's `enrichments[id][path][method]` block (or just `'main'`
   * when no enrichments are configured). See {@link Variant}.
   */
  variant: string
}

export type WithTransformOasOperation = {
  transformOperation: (operation: OasOperation) => void
}

export type IsSupportedOasOperationConfigArgs<EnrichmentType = undefined> = {
  context: GenerateContextType
  operation: OasOperation
  enrichments: EnrichmentType
  /** Operation variant being probed (see {@link Variant}) */
  variant: string
}

export type IsSupportedOasOperationArgs = {
  context: GenerateContextType
  operation: OasOperation
  /** Operation variant being probed (see {@link Variant}) */
  variant: string
}

export type ToOasOperationEnrichmentsArgs = {
  operation: OasOperation
  context: GenerateContextType
  /** Operation variant whose enrichment should be resolved (see {@link Variant}) */
  variant: string
}

export type ToOasOperationPreviewModuleArgs = {
  context: GenerateContextType
  operation: OasOperation
  /** Operation variant the preview module describes (see {@link Variant}) */
  variant: string
}

export type ToOasOperationMappingArgs = {
  context: GenerateContextType
  operation: OasOperation
  /** Operation variant the mapping module describes (see {@link Variant}) */
  variant: string
}

/**
 * Static structural type of an OAS operation projection class.
 *
 * Captures both the instance side (`new(...) => V`) and the static side
 * (`id`, `toIdentifier`, `toExportPath`, `toEnrichments`). Passed as a
 * type parameter to `context.insertOperation(...)`.
 */
export type ToOasOperationIdentifierArgs<EnrichmentType = undefined> = {
  operation: OasOperation
  enrichments: EnrichmentType
  /** Operation variant the identifier should disambiguate (see {@link Variant}) */
  variant: string
}

export type ToOasOperationExportPathArgs<EnrichmentType = undefined> = {
  operation: OasOperation
  enrichments: EnrichmentType
  /** Operation variant the export path should disambiguate (see {@link Variant}) */
  variant: string
}

export type OasOperationProjection<V extends GeneratedValue, EnrichmentType = undefined> = {
  prototype: V
} & {
  new ({
    context,
    settings,
    operation
  }: OasOperationProjectionConstructorArgs<EnrichmentType>): V
  id: string
  type: 'oasOperation'
  /**
   * The projection's language — the static inherited from the language
   * snippet base the projection class is built on
   * (`toOasOperationProjectionBase({ base: TsSnippet, … })`). Drivers read
   * it ephemerally at each use site, pre-construction (cache-hit path).
   */
  lang: Lang
  toIdentifier: (args: ToOasOperationIdentifierArgs<EnrichmentType>) => Identifier
  toExportPath: (args: ToOasOperationExportPathArgs<EnrichmentType>) => string
  toEnrichments: ({ operation, context }: ToOasOperationEnrichmentsArgs) => EnrichmentType
  /**
   * Family-level capability predicate, surfaced as a static by
   * `toOasOperationProjectionBase` (default `() => true`). The Driver
   * probes it on every `insertOperation` so a peer is never handed an
   * operation it has declared unsupported. Optional: a hand-rolled
   * projection may omit it, in which case it is treated as supporting
   * every operation.
   */
  isSupported?: (args: { operation: OasOperation; context: GenerateContextType }) => boolean
  // deno-lint-ignore ban-types
} & Function

/**
 * Pipeline-side configuration for an OAS operation projection (built by
 * `toOasOperationEntry`).
 */
export type OasOperationConfig<EnrichmentType = undefined> = {
  id: string
  type: 'oasOperation'
  /**
   * The target language for this generator. The engine resolves it by
   * `generatorId` (`resolveLang`) — the single source of truth for the
   * generator's language. Set by the author via `toOasOperationEntry({ lang })`.
   */
  lang: Lang
  transform: ({ context, operation, variant }: TransformOasOperationArgs) => void
  toEnrichmentSchema?: () => v.GenericSchema<EnrichmentType>
  isSupported: ({ context, operation }: IsSupportedOasOperationArgs) => boolean
  toPreviewModule?: ({ context, operation }: ToOasOperationPreviewModuleArgs) => PreviewModule
  toMappingModule?: ({ context, operation }: ToOasOperationMappingArgs) => MappingModule
  toEnrichmentRequest?: <RequestedEnrichment extends EnrichmentType>(
    operation: OasOperation
  ) => EnrichmentRequest<RequestedEnrichment> | undefined
}
