import type { GenerateContextType } from '../../context/generateTypes.ts'
import type { Lang } from '@/dsl/Lang.ts'
import type { ContentSettings } from '@/dsl/ContentSettings.ts'
import type { RefName } from '@/types/RefName.ts'
import type { IdentifierType } from '@/dsl/IdentifierType.ts'
import type { IdentifierBase } from '@/dsl/IdentifierBase.ts'
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

export type TransformModelArgs = {
  context: GenerateContextType
  refName: RefName
  /**
   * The model variant the engine is dispatching for this call. The
   * engine fans out one `transform` call per variant declared in the
   * consumer's `enrichments[id][refName]` block (or just `'main'`
   * when no enrichments are configured). See {@link Variant}.
   */
  variant: string
}

/**
 * Arguments a model generator's `isSupported` predicate receives at the
 * entry/dispatch boundary. The capability counterpart of
 * {@link TransformModelArgs}: it carries the resolved enrichment umbrella so
 * the predicate can gate on user config, but no schema — the predicate
 * resolves the schema itself (`context.resolveSchemaRefOnce(refName, id)`)
 * when it needs it, mirroring how `transform` works.
 */
export type IsSupportedModelConfigArgs<EnrichmentType = undefined> = {
  context: GenerateContextType
  refName: RefName
  enrichments: EnrichmentType
  /** Model variant being probed (see {@link Variant}) */
  variant: string
}

/**
 * Arguments the engine passes to the wrapped `isSupported` on a built
 * {@link ModelConfig} — the enrichment-free outer shape (the
 * {@link toModelEntry} wrapper assembles the umbrella before calling the
 * user's predicate).
 */
export type IsSupportedModelArgs = {
  context: GenerateContextType
  refName: RefName
  /** Model variant being probed (see {@link Variant}) */
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
 * Arguments for a model projection's `toIdentifierName` — the pure,
 * cache-key-source half of the old `toIdentifier`.
 */
export type ToModelIdentifierNameArgs<EnrichmentType = undefined> = {
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

/**
 * Static structural type of a model projection class.
 *
 * Captures both the instance side (`new(...) => V`) and the static side
 * (`id`, `toIdentifierName`, `toIdentifierType`, `toExportPath`,
 * `toEnrichments`, `schemaToValueFn`). Passed as a type parameter to
 * `context.insertModel(...)`.
 */
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
  /**
   * The projection's language — the static inherited from the language
   * snippet base the projection class is built on
   * (`toModelProjectionBase(TsSnippet, …)`). Drivers read it
   * pre-construction (cache-hit path). SPIKE (option 2 — see `notes/lang/14`).
   */
  lang: Lang
  /** Pure: the cache-key name. */
  toIdentifierName: (args: ToModelIdentifierNameArgs<EnrichmentType>) => string
  /**
   * Context-aware, overridable: the non-`name` parts of the identifier
   * (`kind` / `typeName` / `exported`), derived from the schema. The engine
   * assembles `lang.toIdentifier({ name: toIdentifierName(args),
   * ...toIdentifierType(refName, context) })`.
   */
  toIdentifierType: (refName: RefName, context: GenerateContextType) => IdentifierType
  toExportPath: (args: ToModelExportPathArgs<EnrichmentType>) => string
  toEnrichments: ({ refName, context, variant }: ToModelEnrichmentsArgs) => EnrichmentType
  /**
   * Family-level capability predicate, surfaced as a static by
   * `toModelProjectionBase` (default `() => true`). The Driver probes it on
   * every `insertModel` so a peer is never handed a model it has declared
   * unsupported. Optional: a hand-rolled projection may omit it, in which
   * case it is treated as supporting every model.
   */
  isSupported?: (args: { refName: RefName; context: GenerateContextType }) => boolean
  schemaToValueFn: SchemaToValueFn
  /**
   * The inline-schema fallback seam used by `insertNormalizedModel` when a
   * schema is not a `$ref`: builds the Definition's identifier from a bare
   * `fallbackName`. A generator static; returns the neutral `IdentifierBase`
   * (the engine reads only `.name`).
   */
  createIdentifier: (name: string) => IdentifierBase
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
  transform: ({ context, refName, variant }: TransformModelArgs) => void
  /**
   * Capability gate, evaluated by the engine before `include` / `skip`. A
   * model whose predicate returns `false` is recorded `notSupported` and its
   * `transform` is skipped. Always present on a built config —
   * {@link toModelEntry} defaults it to `() => true` when the generator
   * declares none — so the dispatcher can call it unconditionally.
   */
  isSupported: ({ context, refName }: IsSupportedModelArgs) => boolean
  toPreviewModule?: ({ context, refName, variant }: ToModelPreviewModuleArgs) => PreviewModule
  toMappingModule?: ({ context, refName, variant }: ToModelMappingArgs) => MappingModule
  toEnrichmentSchema: () => v.GenericSchema<EnrichmentType>
  toEnrichmentRequest?: <RequestedEnrichment extends EnrichmentType>(
    refName: RefName
  ) => EnrichmentRequest<RequestedEnrichment> | undefined
  /**
   * Optional: compute the DEFAULT enrichment values for a model from its schema
   * — the seed the CMS persists and the user then edits. The pipeline
   * counterpart of the projection base's static of the same name; a generator
   * forwards `MyProjection.toEnrichmentDefaults` here so the seeding pass can
   * reach it via the generator-config map. Returns the `{ subject, generator,
   * stack }` umbrella, or `undefined` when no defaults are advertised.
   */
  toEnrichmentDefaults?: ({
    refName,
    context,
    variant
  }: ToModelEnrichmentsArgs) => EnrichmentType | undefined
}
