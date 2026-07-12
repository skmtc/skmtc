import { toWebhookGeneratorKey } from '@/dsl/GeneratorKeys.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import type {
  InsertOperationOptions,
  InsertModelOptions,
  InsertNormalizedModelArgs,
  InsertNormalizedModelReturn
} from '@/context/generateTypes.ts'
import type { OasWebhook } from '@/oas/webhook/Webhook.ts'
import type { OasOperation } from '@/oas/operation/Operation.ts'
import type { ContentSettings } from '@/dsl/ContentSettings.ts'
import type { LangSnippetConstructor } from '@/dsl/Lang.ts'
import type { IdentifierType } from '@/dsl/IdentifierType.ts'
import type { GeneratedValue } from '@/dsl/GeneratedValue.ts'
import type { Inserted } from '@/dsl/Inserted.ts'
import type { ModelProjection } from '@/dsl/model/types.ts'
import type { OasOperationProjection } from '@/dsl/operation/oas/types.ts'
import type { RefName } from '@/types/RefName.ts'
import type { OasSchema } from '@/oas/schema/Schema.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import type { OasVoid } from '@/oas/void/Void.ts'
import type {
  WebhookProjectionConstructorArgs,
  ToWebhookIdentifierNameArgs,
  ToWebhookExportPathArgs
} from '@/dsl/webhook/types.ts'
import type * as v from 'valibot'
import { DEFAULT_VARIANT } from '@/types/Variant.ts'
import { parseEnrichmentUmbrella } from '@/enrichments/parseEnrichmentUmbrella.ts'

/**
 * Configuration for {@link toWebhookProjectionBase}.
 *
 * Sibling of `OasOperationProjectionBaseConfig` for the webhook subject.
 * Generic over the identifier-type shape `IdType`: a language veneer
 * parameterizes this config with its own `XxIdentifierType`
 * (`WebhookProjectionBaseConfig<E, KtIdentifierType>`) so `toIdentifierType`'s
 * return tightens to that language's `type` vocabulary — no recast.
 */
export type WebhookProjectionBaseConfig<
  EnrichmentType = undefined,
  IdType extends IdentifierType = IdentifierType
> = {
  id: string
  /** Pure: the cache-key name (the cache-check path runs this). */
  toIdentifierName: (args: ToWebhookIdentifierNameArgs<EnrichmentType>) => string
  /**
   * Context-aware, overridable: the non-`name` parts of the identifier,
   * derived from the webhook. Runs only on cache-miss. Returns this
   * language's `XxIdentifierType` (`IdType`; the loose `type: string` by default).
   */
  toIdentifierType: (webhook: OasWebhook, context: GenerateContextType) => IdType
  toExportPath: (args: ToWebhookExportPathArgs<EnrichmentType>) => string
  /**
   * Required composite schema for the `{ subject, generator, stack }`
   * enrichment umbrella. Required (not optional) is load-bearing: it is what
   * lets `static toEnrichments` parse cast-free. A no-enrichment generator
   * passes `emptyEnrichmentSchema`.
   */
  toEnrichmentSchema: () => v.GenericSchema<EnrichmentType>
  /**
   * Optional: compute the DEFAULT enrichment values for a webhook from its
   * schema — the seed the CMS persists and the user then edits (vs
   * {@link toEnrichments}, which READS already-authored values).
   */
  toEnrichmentDefaults?: (args: ToEnrichmentsArgs) => EnrichmentType | undefined
  /**
   * Family-level applicability predicate. Becomes a static `isSupported`
   * on the returned base class so other projections can probe it via the
   * webhook-reference protocol. When omitted, advertises support for every
   * webhook.
   */
  isSupported?: (args: { webhook: OasWebhook; context: GenerateContextType }) => boolean
}

type ToEnrichmentsArgs = {
  webhook: OasWebhook
  context: GenerateContextType
  /** Webhook variant whose enrichment should be resolved (see {@link Variant}) */
  variant: string
}

/**
 * Build a webhook projection base class from a per-generator config.
 *
 * Sibling of `toOasOperationProjectionBase`. The returned class extends
 * `base` — the generator's language snippet base — so the projection
 * hierarchy is language-bound at its root while core stays language-blind.
 * It exposes the generator's `id`, `toIdentifierName`, `toIdentifierType`,
 * `toExportPath`, `toEnrichments`, and `isSupported` statics, inherits the
 * static `lang` from the base, and injects the webhook `generatorKey`.
 *
 * Defines NO `register` / `registerInto` — those live in the language
 * package's projection-base veneer over this factory.
 */
export const toWebhookProjectionBase = <
  EnrichmentType = undefined,
  IdType extends IdentifierType = IdentifierType
>(
  base: LangSnippetConstructor,
  config: WebhookProjectionBaseConfig<EnrichmentType, IdType>
) => {
  return class extends base {
    static id = config.id
    static type = 'webhook' as const

    static toIdentifierName = config.toIdentifierName.bind(config)
    static toIdentifierType = config.toIdentifierType.bind(config)
    static toExportPath = config.toExportPath.bind(config)

    static isSupported = config.isSupported ?? (() => true)

    static toEnrichments = ({ webhook, context, variant }: ToEnrichmentsArgs): EnrichmentType => {
      // The three enrichment scopes assembled into the umbrella a generator
      // reads off `this.settings.enrichments`. Subject is per-item
      // (`[id][name][method][variant]`) — the variant axis is core-owned, and
      // the engine has already asserted `'main'` exists; generator and stack
      // are run-constants (`[id][_generator]`, `[_stack]`). The required
      // composite schema parses the raw umbrella once — typed, cast-free.
      // The helper routes the reads through the recording accessor
      // (consumption audit) and reports schema-dropped keys.
      return parseEnrichmentUmbrella({
        context,
        generatorId: config.id,
        subjectSegments: [webhook.name, webhook.method, variant],
        schema: config.toEnrichmentSchema()
      })
    }

    /**
     * Derive the seed enrichment values for a webhook from its schema.
     * Returns `undefined` when the generator declares no
     * `toEnrichmentDefaults` — the common case.
     */
    static toEnrichmentDefaults = (args: ToEnrichmentsArgs): EnrichmentType | undefined =>
      config.toEnrichmentDefaults?.call(config, args)

    settings: ContentSettings<EnrichmentType>
    webhook: OasWebhook

    constructor(args: WebhookProjectionConstructorArgs<EnrichmentType>) {
      super({
        context: args.context,
        generatorKey: toWebhookGeneratorKey({
          generatorId: config.id,
          webhook: args.webhook,
          variant: args.settings.variant ?? DEFAULT_VARIANT
        })
      })

      this.webhook = args.webhook
      this.settings = args.settings
    }

    /**
     * Insert a related operation (the operation-reference protocol — e.g. a
     * webhook handler that references a list endpoint). Exported to this
     * projection's own `exportPath` unless `noExport` is set.
     */
    insertOperation<V extends GeneratedValue, PeerEnrichmentType = undefined>(
      projection: OasOperationProjection<V, PeerEnrichmentType>,
      operation: OasOperation,
      options: Pick<InsertOperationOptions, 'noExport' | 'variant'> = {}
    ): Inserted<V, PeerEnrichmentType> {
      return this.context.insertOperation({
        projection,
        operation,
        destinationPath: this.settings.exportPath,
        noExport: options.noExport,
        variant: options.variant
      })
    }

    /**
     * Insert a related model into this projection's export file (e.g. the
     * webhook's payload type).
     */
    insertModel<V extends GeneratedValue, PeerEnrichmentType = undefined>(
      projection: ModelProjection<V, PeerEnrichmentType>,
      refName: RefName,
      options: Pick<InsertModelOptions, 'noExport' | 'variant'> = {}
    ): Inserted<V, PeerEnrichmentType> {
      return this.context.insertModel(projection, refName, {
        destinationPath: this.settings.exportPath,
        noExport: options.noExport,
        variant: options.variant
      })
    }

    /**
     * Insert a related model with reference normalization. Useful for inline
     * payload schemas where the schema may be either a `$ref` or a concrete
     * object.
     */
    insertNormalizedModel<
      V extends GeneratedValue,
      Schema extends OasSchema | OasRef<'schema'> | OasVoid,
      PeerEnrichmentType = undefined
    >(
      projection: ModelProjection<V, PeerEnrichmentType>,
      { schema, fallbackName }: Omit<InsertNormalizedModelArgs<Schema>, 'destinationPath'>,
      options: Pick<InsertModelOptions, 'noExport' | 'variant'> = {}
    ): InsertNormalizedModelReturn<V, Schema> {
      return this.context.insertNormalizedModel(
        projection,
        {
          schema,
          fallbackName,
          destinationPath: this.settings.exportPath
        },
        {
          noExport: options.noExport,
          variant: options.variant
        }
      )
    }
  }
}
