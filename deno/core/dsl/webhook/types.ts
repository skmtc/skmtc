import type { OasWebhook } from '@/oas/webhook/Webhook.ts'
import type { Lang } from '@/dsl/Lang.ts'
import type { ContentSettings } from '@/dsl/ContentSettings.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import type { IdentifierType } from '@/dsl/IdentifierType.ts'
import type { GeneratedValue } from '@/dsl/GeneratedValue.ts'
import type { ProjectionOptionsArg } from '@/types/ProjectionOptions.ts'

/**
 * External constructor signature for a webhook projection class.
 *
 * The pipeline calls `new SomeProjection(args)` with this shape; the
 * runtime base class injects `generatorKey` before calling `super()`.
 *
 * Mirrors `OasOperationProjectionConstructorArgs` with `webhook` for
 * `operation` — webhooks are a distinct subject ({@link OasWebhook}),
 * so the field name and type differ even though the shape matches.
 */
export type WebhookProjectionConstructorArgs<
  EnrichmentType = undefined,
  ProjectionOptions = undefined
> = {
  context: GenerateContextType
  settings: ContentSettings<EnrichmentType>
  webhook: OasWebhook
} & ProjectionOptionsArg<ProjectionOptions>

export type TransformWebhookArgs = {
  context: GenerateContextType
  webhook: OasWebhook
  /**
   * The webhook variant the engine is dispatching for this call. The
   * engine fans out one `transform` call per variant declared in the
   * consumer's `enrichments[id][name][method]` block (or just `'main'`
   * when no enrichments are configured). See {@link Variant}.
   */
  variant: string
}

export type IsSupportedWebhookArgs = {
  context: GenerateContextType
  webhook: OasWebhook
  /** Webhook variant being probed (see {@link Variant}) */
  variant: string
}

export type ToWebhookEnrichmentsArgs = {
  webhook: OasWebhook
  context: GenerateContextType
  /** Webhook variant whose enrichment should be resolved (see {@link Variant}) */
  variant: string
}

export type ToWebhookPreviewModuleArgs = {
  context: GenerateContextType
  webhook: OasWebhook
  /** Webhook variant the preview module describes (see {@link Variant}) */
  variant: string
}

export type ToWebhookMappingArgs = {
  context: GenerateContextType
  webhook: OasWebhook
  /** Webhook variant the mapping module describes (see {@link Variant}) */
  variant: string
}

/**
 * Arguments for a webhook projection's `toIdentifierName`. Fold `options` into the name when the output
 * depends on them: definitions are cached by name and export path.
 */
export type ToWebhookIdentifierNameArgs<
  EnrichmentType = undefined,
  ProjectionOptions = undefined
> = {
  webhook: OasWebhook
  enrichments: EnrichmentType
  /** Webhook variant the identifier should disambiguate (see {@link Variant}) */
  variant: string
} & ProjectionOptionsArg<ProjectionOptions>

export type ToWebhookExportPathArgs<EnrichmentType = undefined, ProjectionOptions = undefined> = {
  webhook: OasWebhook
  enrichments: EnrichmentType
  /** Webhook variant the export path should disambiguate (see {@link Variant}) */
  variant: string
} & ProjectionOptionsArg<ProjectionOptions>

/**
 * Static structural type of a webhook projection class.
 *
 * Captures both the instance side (`new(...) => V`) and the static side
 * (`id`, `toIdentifierName`, `toIdentifierType`, `toExportPath`,
 * `toEnrichments`). Passed as a type parameter to
 * `context.insertWebhook(...)`. `ProjectionOptions` is the caller options
 * the class declares; the Drivers infer it from the constructor and statics.
 */
export type WebhookProjection<
  V extends GeneratedValue,
  EnrichmentType = undefined,
  ProjectionOptions = undefined
> = {
  prototype: V
} & {
  new ({
    context,
    settings,
    webhook,
    options
  }: WebhookProjectionConstructorArgs<EnrichmentType, ProjectionOptions>): V
  id: string
  type: 'webhook'
  /**
   * The projection's language — the static inherited from the language
   * snippet base the projection class is built on
   * (`toWebhookProjectionBase(TsSnippet, …)`). Drivers read it ephemerally
   * at each use site, pre-construction (cache-hit path).
   */
  lang: Lang
  /** Pure: the cache-key name. */
  toIdentifierName: (args: ToWebhookIdentifierNameArgs<EnrichmentType, ProjectionOptions>) => string
  /**
   * Context-aware, overridable: the non-`name` parts of the identifier,
   * derived from the webhook. The engine assembles
   * `lang.toIdentifier({ name: toIdentifierName(args),
   * ...toIdentifierType(webhook, context) })`.
   */
  toIdentifierType: (webhook: OasWebhook, context: GenerateContextType) => IdentifierType
  toExportPath: (args: ToWebhookExportPathArgs<EnrichmentType, ProjectionOptions>) => string
  toEnrichments: ({ webhook, context }: ToWebhookEnrichmentsArgs) => EnrichmentType
  /**
   * Family-level capability predicate, surfaced as a static by
   * `toWebhookProjectionBase` (default `() => true`). The Driver probes it
   * on every `insertWebhook` so a peer is never handed a webhook it has
   * declared unsupported. Optional: a hand-rolled projection may omit it,
   * in which case it is treated as supporting every webhook.
   */
  isSupported?: (args: IsSupportedWebhookArgs) => boolean
  // deno-lint-ignore ban-types
} & Function
