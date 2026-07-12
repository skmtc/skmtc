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
import type { IdentifierType } from '@/dsl/IdentifierType.ts'
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
  ToGqlOperationIdentifierNameArgs,
  ToGqlOperationExportPathArgs
} from './types.ts'
import { toGqlOperationGeneratorKey } from '@/dsl/GeneratorKeys.ts'
import * as v from 'valibot'
// @deno-types="npm:@types/lodash-es@4.17.12/get.d.ts"
import get from 'lodash-es/get'
import { DEFAULT_VARIANT } from '@/types/Variant.ts'
import { GENERATOR_ENRICHMENT_KEY, STACK_ENRICHMENT_KEY } from '@/types/Enrichments.ts'

/**
 * Configuration for {@link toGqlOperationProjectionBase}.
 *
 * Generic over the language `L`: a language veneer parameterizes this config
 * (`GqlOperationProjectionBaseConfig<E, KtIdentifierType>`) so
 * `toIdentifierType`'s return tightens to that language's `type` vocabulary —
 * no recast.
 */
export type GqlOperationProjectionBaseConfig<
  EnrichmentType = undefined,
  IdType extends IdentifierType = IdentifierType
> = {
  id: string
  /** Pure: the cache-key name (the cache-check path runs this). */
  toIdentifierName: (args: ToGqlOperationIdentifierNameArgs<EnrichmentType>) => string
  /**
   * Context-aware, overridable: the non-`name` parts of the identifier,
   * derived from the operation/schema. Runs only on cache-miss. Returns this
   * language's `XxIdentifierType` (`IdType`; the loose `kind: string` by
   * default); the tightening rides the type argument.
   */
  toIdentifierType: (operation: GqlOperation, context: GenerateContextType) => IdType
  toExportPath: (args: ToGqlOperationExportPathArgs<EnrichmentType>) => string
  /**
   * Required composite schema for the `{ subject, generator, stack }`
   * enrichment umbrella. Required (not optional) is load-bearing: it is what
   * lets `static toEnrichments` parse cast-free. A no-enrichment generator
   * passes `emptyEnrichmentSchema`.
   */
  toEnrichmentSchema: () => v.GenericSchema<EnrichmentType>
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
 * The returned class extends `base` — the generator's language
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
 * `GqlOperationProjectionBase` lives here now, because the base class is no
 * longer statically known.
 */
export const toGqlOperationProjectionBase = <
  EnrichmentType = undefined,
  IdType extends IdentifierType = IdentifierType
>(
  base: LangSnippetConstructor,
  config: GqlOperationProjectionBaseConfig<EnrichmentType, IdType>
) => {
  return class extends base {
    static id = config.id
    static type = 'gqlOperation' as const

    static toIdentifierName = config.toIdentifierName.bind(config)
    static toIdentifierType = config.toIdentifierType.bind(config)
    static toExportPath = config.toExportPath.bind(config)

    static isSupported = config.isSupported ?? (() => true)

    static toEnrichments = ({ operation, context, variant }: ToEnrichmentsArgs): EnrichmentType => {
      // The three enrichment scopes assembled into the umbrella a generator
      // reads off `this.settings.enrichments`. Subject is per-operation
      // (`[id][rootKind][fieldName][variant]`) — GraphQL has no path/method,
      // and the variant axis is core-owned; generator and stack are
      // run-constants (`[id][_generator]`, `[_stack]`). The required composite
      // schema parses the raw umbrella once — typed, cast-free.
      const raw = {
        subject: get(context.settings, [
          'enrichments',
          config.id,
          operation.rootKind,
          operation.fieldName,
          variant
        ]),
        generator: get(context.settings, ['enrichments', config.id, GENERATOR_ENRICHMENT_KEY]),
        stack: get(context.settings, ['enrichments', STACK_ENRICHMENT_KEY])
      }

      return v.parse(config.toEnrichmentSchema(), raw)
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
