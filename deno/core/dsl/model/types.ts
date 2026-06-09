import type { GenerateContextType } from '../../context/generateTypes.ts'
import type { Lang } from '@/dsl/Lang.ts'
import type { ContentSettings } from '@/dsl/ContentSettings.ts'
import type { RefName } from '@/types/RefName.ts'
import type { Identifier } from '@/dsl/Identifier.ts'
import type { GeneratedValue } from '@/dsl/GeneratedValue.ts'
import type { EnrichmentRequest } from '@/types/EnrichmentRequest.ts'
import type * as v from 'valibot'
import type { MappingModule, PreviewModule } from '@/types/Preview.ts'
import type { SchemaToValueFn } from '@/types/TypeSystem.ts'

/**
 * External constructor signature for a model projection class.
 *
 * The pipeline calls `new SomeProjection(args)` with this shape; the
 * runtime base class ({@link ModelProjectionBase}) injects `generatorKey`
 * before calling `super()`.
 */
export type ModelProjectionConstructorArgs<EnrichmentType = undefined> = {
  context: GenerateContextType
  refName: RefName
  settings: ContentSettings<EnrichmentType>
  destinationPath: string
  rootRef?: RefName
}

export type WithTransformModel = {
  transformModel: (refName: RefName) => void
}

export type ToModelEnrichmentsArgs = {
  refName: RefName
  context: GenerateContextType
  /** Model variant whose enrichment should be resolved (see {@link Variant}) */
  variant: string
}

export type TransformModelArgs<Acc> = {
  context: GenerateContextType
  refName: RefName
  acc: Acc | undefined
  /**
   * The model variant the engine is dispatching for this call. The
   * engine fans out one `transform` call per variant declared in the
   * consumer's `enrichments[id][refName]` block (or just `'main'`
   * when no enrichments are configured). See {@link Variant}.
   */
  variant: string
}

export type ToModelPreviewModuleArgs = {
  context: GenerateContextType
  refName: RefName
  /** Model variant the preview module describes (see {@link Variant}) */
  variant: string
}

export type ToModelMappingArgs = {
  context: GenerateContextType
  refName: RefName
  /** Model variant the mapping module describes (see {@link Variant}) */
  variant: string
}

/**
 * Static structural type of a model projection class.
 *
 * Captures both the instance side (`new(...) => V`) and the static side
 * (`id`, `toIdentifier`, `toExportPath`, `toEnrichments`,
 * `schemaToValueFn`, `createIdentifier`). Passed as a type parameter to
 * `context.insertModel(...)`.
 */
export type ToModelIdentifierArgs<EnrichmentType = undefined> = {
  refName: RefName
  enrichments: EnrichmentType
  /** Model variant the identifier should disambiguate (see {@link Variant}) */
  variant: string
}

export type ToModelExportPathArgs<EnrichmentType = undefined> = {
  refName: RefName
  enrichments: EnrichmentType
  /** Model variant the export path should disambiguate (see {@link Variant}) */
  variant: string
}

export type ModelProjection<V extends GeneratedValue, EnrichmentType = undefined> = {
  prototype: V
} & {
  new ({
    context,
    refName,
    settings,
    destinationPath,
    rootRef
  }: ModelProjectionConstructorArgs<EnrichmentType>): V
  id: string
  type: 'model'
  toIdentifier: (args: ToModelIdentifierArgs<EnrichmentType>) => Identifier
  toExportPath: (args: ToModelExportPathArgs<EnrichmentType>) => string
  toEnrichments: ({ refName, context, variant }: ToModelEnrichmentsArgs) => EnrichmentType
  schemaToValueFn: SchemaToValueFn
  createIdentifier: (name: string) => Identifier
  // deno-lint-ignore ban-types
} & Function

/**
 * Pipeline-side configuration for a model projection (built by
 * `toModelEntry`). Carries the iteration callback (`transform`) and
 * optional preview/mapping/enrichment hooks.
 */
export type ModelConfig<EnrichmentType = undefined> = {
  id: string
  type: 'model'
  /**
   * The target language for this generator. The engine resolves it by
   * `generatorId` (`resolveLang`) — the single source of truth for the
   * generator's language. Set by the author via `toModelEntry({ lang })`.
   */
  lang: Lang
  transform: <Acc = void>({ context, refName, acc, variant }: TransformModelArgs<Acc>) => Acc
  toPreviewModule?: ({ context, refName, variant }: ToModelPreviewModuleArgs) => PreviewModule
  toMappingModule?: ({ context, refName, variant }: ToModelMappingArgs) => MappingModule
  toEnrichmentSchema?: () => v.BaseSchema<EnrichmentType, EnrichmentType, v.BaseIssue<unknown>>
  toEnrichmentRequest?: <RequestedEnrichment extends EnrichmentType>(
    refName: RefName
  ) => EnrichmentRequest<RequestedEnrichment> | undefined
}
