import type { GenerateContextType } from '@/context/generateTypes.ts'
import type {
  InsertOperationOptions,
  InsertModelOptions,
  InsertNormalizedModelArgs,
  InsertNormalizedModelReturn
} from '@/context/generateTypes.ts'
import type { GqlOperation } from '@/gql/operation/GqlOperation.ts'
import type { ContentSettings } from '@/dsl/ContentSettings.ts'
import type { LangSnippetConstructor } from '@/dsl/Lang.ts'
import type { Identifier } from '@/dsl/Identifier.ts'
import type { GeneratedValue } from '@/dsl/GeneratedValue.ts'
import type { Inserted } from '@/dsl/Inserted.ts'
import type { ModelProjection } from '@/dsl/model/types.ts'
import type { RefName } from '@/types/RefName.ts'
import type { OasSchema } from '@/oas/schema/Schema.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import type { OasVoid } from '@/oas/void/Void.ts'
import type {
  GqlOperationProjection,
  GqlOperationProjectionConstructorArgs,
  ToGqlOperationIdentifierArgs,
  ToGqlOperationExportPathArgs
} from './types.ts'
import { toGqlOperationGeneratorKey } from '@/dsl/GeneratorKeys.ts'
import * as v from 'valibot'
// @deno-types="npm:@types/lodash-es@4.17.12/get.d.ts"
import get from 'lodash-es/get'
import { DEFAULT_VARIANT } from '@/types/Variant.ts'

/**
 * Configuration for {@link toGqlOperationProjectionBase}.
 */
export type GqlOperationProjectionBaseConfig<EnrichmentType = undefined> = {
  /**
   * The language snippet base the projection class is built on — a
   * `@skmtc/lang-*` package's snippet base (e.g. `TsSnippet`). This is where
   * language enters the class hierarchy: the base carries the static `lang`,
   * read by Drivers pre-construction and inherited by every class built on
   * it. Language packages pre-bind it in their projection-base veneers.
   */
  base: LangSnippetConstructor
  id: string
  toIdentifier: (args: ToGqlOperationIdentifierArgs<EnrichmentType>) => Identifier
  toExportPath: (args: ToGqlOperationExportPathArgs<EnrichmentType>) => string
  toEnrichmentSchema?: () => v.BaseSchema<EnrichmentType, EnrichmentType, v.BaseIssue<unknown>>
  /**
   * Family-level applicability predicate. Becomes a static `isSupported`
   * on the returned base class so other projections can probe it via the
   * operation-reference protocol. When omitted, advertises support for
   * every operation.
   */
  isSupported?: (args: { operation: GqlOperation; context: GenerateContextType }) => boolean
}

type ToEnrichmentsArgs = {
  operation: GqlOperation
  context: GenerateContextType
  /** Operation variant whose enrichment should be resolved (see {@link Variant}) */
  variant: string
}

/**
 * Build a GraphQL operation projection base class from a per-generator
 * config.
 *
 * The returned class extends `config.base` — the generator's language
 * snippet base — so the projection hierarchy is language-bound at its root
 * while core stays language-blind (the base arrives as an opaque
 * constructor; core never names a concrete language class). The class
 * exposes the generator's `id`, `toIdentifier`, `toExportPath`,
 * `toEnrichments`, and `isSupported` statics, inherits the static `lang`
 * from the base, and injects `generatorKey` so subclasses don't have to.
 *
 * Defines NO `register` / `registerInto` — register ergonomics are typed by
 * each language's concise vocabulary, which core can't name, so they live
 * in the language package's projection-base veneer over this factory.
 *
 * The projection machinery previously hosted on
 * `GqlOperationProjectionBase` lives here now, because the base class is no
 * longer statically known.
 */
export const toGqlOperationProjectionBase = <EnrichmentType = undefined>(
  config: GqlOperationProjectionBaseConfig<EnrichmentType>
) => {
  return class extends config.base {
    static id = config.id
    static type = 'gqlOperation' as const

    static toIdentifier = config.toIdentifier.bind(config)
    static toExportPath = config.toExportPath.bind(config)

    static isSupported = config.isSupported ?? (() => true)

    static toEnrichments = ({
      operation,
      context,
      variant
    }: ToEnrichmentsArgs): EnrichmentType => {
      // Same shape as the OAS branch — see the comment there for the
      // full rationale. GraphQL routing key is
      // `[generatorId][rootKind][fieldName][variant]`.
      const operationEnrichments = get(
        context.settings,
        `enrichments.${config.id}.${operation.rootKind}.${operation.fieldName}.${variant}`
      )

      const enrichmentSchema = config.toEnrichmentSchema?.() ?? v.optional(v.unknown())

      return v.parse(enrichmentSchema, operationEnrichments) as EnrichmentType
    }

    settings: ContentSettings<EnrichmentType>
    operation: GqlOperation

    constructor(args: GqlOperationProjectionConstructorArgs<EnrichmentType>) {
      super({
        context: args.context,
        generatorKey: toGqlOperationGeneratorKey({
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
      projection: GqlOperationProjection<V, PeerEnrichmentType>,
      operation: GqlOperation,
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
     * Insert a related model with reference normalization. Useful for
     * schemas that may be either a `$ref` or a concrete object.
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
