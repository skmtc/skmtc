import { toOasOperationGeneratorKey } from '@/dsl/GeneratorKeys.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import type {
  InsertOperationOptions,
  InsertModelOptions,
  InsertNormalizedModelArgs,
  InsertNormalizedModelReturn
} from '@/context/generateTypes.ts'
import type { OasOperation } from '@/oas/operation/Operation.ts'
import type { ContentSettings } from '@/dsl/ContentSettings.ts'
import type { Lang, LangSnippetConstructor } from '@/dsl/Lang.ts'
import type { IdentifierType } from '@/dsl/IdentifierType.ts'
import type { GeneratedValue } from '@/dsl/GeneratedValue.ts'
import type { Inserted } from '@/dsl/Inserted.ts'
import type { ModelProjection } from '@/dsl/model/types.ts'
import type { RefName } from '@/types/RefName.ts'
import type { OasSchema } from '@/oas/schema/Schema.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import type { OasVoid } from '@/oas/void/Void.ts'
import type {
  OasOperationProjection,
  OasOperationProjectionConstructorArgs,
  ToOasOperationIdentifierNameArgs,
  ToOasOperationExportPathArgs
} from '@/dsl/operation/oas/types.ts'
import * as v from 'valibot'
// @deno-types="npm:@types/lodash-es@4.17.12/get.d.ts"
import get from 'lodash-es/get'
import { DEFAULT_VARIANT } from '@/types/Variant.ts'

/**
 * Configuration for {@link toOasOperationProjectionBase}.
 *
 * Generic over the language `L`: a language veneer parameterizes this config
 * (`OasOperationProjectionBaseConfig<E, KtLang>`) so `toIdentifierType`'s
 * return tightens to that language's `IdentifierType<L>` — no recast.
 */
export type OasOperationProjectionBaseConfig<EnrichmentType = undefined, L extends Lang = Lang> = {
  /**
   * The language snippet base the projection class is built on — a
   * `@skmtc/lang-*` package's snippet base (e.g. `TsSnippet`). This is where
   * language enters the class hierarchy: the base carries the static `lang`,
   * read by Drivers pre-construction and inherited by every class built on
   * it. Language packages pre-bind it in their projection-base veneers.
   * Typed `LangSnippetConstructor<L>`, so `L` is inferred from the base.
   */
  base: LangSnippetConstructor<L>
  id: string
  /** Pure: the cache-key name (the cache-check path runs this). */
  toIdentifierName: (args: ToOasOperationIdentifierNameArgs<EnrichmentType>) => string
  /**
   * Context-aware, overridable: the non-`name` parts of the identifier,
   * derived from the operation/schema. Runs only on cache-miss. Returns this
   * language's `IdentifierType<L>` (the loose `kind: string` when `L = Lang`);
   * the tightening rides the type argument, replacing the old veneer recast.
   */
  toIdentifierType: (operation: OasOperation, context: GenerateContextType) => IdentifierType<L>
  toExportPath: (args: ToOasOperationExportPathArgs<EnrichmentType>) => string
  toEnrichmentSchema?: () => v.BaseSchema<EnrichmentType, EnrichmentType, v.BaseIssue<unknown>>
  /**
   * Family-level applicability predicate. Becomes a static `isSupported`
   * on the returned base class so other projections can probe it via the
   * operation-reference protocol. When omitted, advertises support for
   * every operation.
   */
  isSupported?: (args: { operation: OasOperation; context: GenerateContextType }) => boolean
}

type ToEnrichmentsArgs = {
  operation: OasOperation
  context: GenerateContextType
  /** Operation variant whose enrichment should be resolved (see {@link Variant}) */
  variant: string
}

/**
 * Build an OAS operation projection base class from a per-generator config.
 *
 * The returned class extends `config.base` — the generator's language
 * snippet base — so the projection hierarchy is language-bound at its root
 * while core stays language-blind (the base arrives as an opaque
 * constructor; core never names a concrete language class). The class
 * exposes the generator's `id`, `toIdentifierName`, `toIdentifierType`,
 * `toExportPath`, `toEnrichments`, and `isSupported` statics, inherits the
 * static `lang`
 * from the base, and injects `generatorKey` so subclasses don't have to.
 *
 * Defines NO `register` / `registerInto` — register ergonomics are typed by
 * each language's concise vocabulary, which core can't name, so they live
 * in the language package's projection-base veneer over this factory.
 *
 * The projection machinery previously hosted on
 * `OasOperationProjectionBase` lives here now, because the base class is no
 * longer statically known.
 */
export const toOasOperationProjectionBase = <EnrichmentType = undefined, L extends Lang = Lang>(
  config: OasOperationProjectionBaseConfig<EnrichmentType, L>
) => {
  return class extends config.base {
    static id = config.id
    static type = 'oasOperation' as const

    static toIdentifierName = config.toIdentifierName.bind(config)
    static toIdentifierType = config.toIdentifierType.bind(config)
    static toExportPath = config.toExportPath.bind(config)

    static isSupported = config.isSupported ?? (() => true)

    static toEnrichments = ({
      operation,
      context,
      variant
    }: ToEnrichmentsArgs): EnrichmentType => {
      // The variant axis is owned by core: consumer enrichments are keyed
      // `[generatorId][path][method][variant]`, and the generator's own
      // schema describes the per-variant inner value. The engine has
      // already enumerated valid variants and asserted `'main'` exists,
      // so the lookup here either hits a declared variant or — for the
      // synthetic single-`'main'` pass when no enrichments are
      // configured — returns `undefined`, which the Valibot schema
      // accepts via its `v.optional(...)` envelope.
      const operationEnrichments = get(
        context.settings,
        ['enrichments', config.id, operation.path, operation.method, variant]
      )

      const enrichmentSchema = config.toEnrichmentSchema?.() ?? v.optional(v.unknown())

      return v.parse(enrichmentSchema, operationEnrichments) as EnrichmentType
    }

    settings: ContentSettings<EnrichmentType>
    operation: OasOperation

    constructor(args: OasOperationProjectionConstructorArgs<EnrichmentType>) {
      super({
        context: args.context,
        generatorKey: toOasOperationGeneratorKey({
          generatorId: config.id,
          operation: args.operation,
          variant: args.settings.variant ?? DEFAULT_VARIANT
        })
      })

      this.operation = args.operation
      this.settings = args.settings
    }

    /**
     * Insert a related operation. The inserted operation is exported to this
     * projection's own `exportPath` unless `noExport` is set.
     *
     * Pass `{ variant }` to target a specific variant on the peer (e.g.
     * to thread `this.settings.variant` into a within-package sibling
     * Projection that's also variants-aware). Omitting it defaults to
     * the peer's `'main'` variant — the safe choice for variants-unaware
     * peers and the standard pattern for cross-package composition.
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
     * Insert a related model into this projection's export file.
     *
     * Pass `{ variant }` to target a specific variant on the peer model
     * projection. Omitting it defaults to the peer's `'main'` variant.
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
     * request/response schemas where the schema may be either a `$ref` or a
     * concrete object.
     *
     * `{ variant }` flows through the `$ref` branch only; for inline
     * schemas, bake the variant into `fallbackName`.
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
