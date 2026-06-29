import type { GenerateContextType } from '../../context/generateTypes.ts'
import type {
  InsertModelOptions,
  InsertNormalizedModelArgs,
  InsertNormalizedModelReturn
} from '../../context/generateTypes.ts'
import { toModelGeneratorKey } from '@/dsl/GeneratorKeys.ts'
import type { RefName } from '@/types/RefName.ts'
import type { ContentSettings } from '@/dsl/ContentSettings.ts'
import type { LangSnippetConstructor } from '@/dsl/Lang.ts'
import type { IdentifierType } from '@/dsl/IdentifierType.ts'
import type { GeneratedValue } from '@/dsl/GeneratedValue.ts'
import type { Inserted } from '@/dsl/Inserted.ts'
import type { OasSchema } from '@/oas/schema/Schema.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import type { OasVoid } from '@/oas/void/Void.ts'
import type {
  ModelProjection,
  ToModelIdentifierNameArgs,
  ToModelExportPathArgs
} from '@/dsl/model/types.ts'
import * as v from 'valibot'
import { DEFAULT_VARIANT } from '@/types/Variant.ts'
import { GENERATOR_ENRICHMENT_KEY, STACK_ENRICHMENT_KEY } from '@/types/Enrichments.ts'
// @deno-types="npm:@types/lodash-es@4.17.12/get.d.ts"
import get from 'lodash-es/get'

/**
 * Arguments accepted by classes generated via {@link toModelProjectionBase}.
 *
 * The factory injects `generatorKey` before delegating to the language
 * snippet base, so user code only supplies these three fields.
 */
export type ModelProjectionArgs<EnrichmentType = undefined> = {
  context: GenerateContextType
  settings: ContentSettings<EnrichmentType>
  refName: RefName
}

type ToEnrichmentsArgs = {
  refName: RefName
  context: GenerateContextType
  /** Model variant whose enrichment should be resolved (see {@link Variant}) */
  variant: string
}

/**
 * Configuration for {@link toModelProjectionBase}.
 *
 * Generic over the identifier-type shape `IdType`: a language veneer
 * parameterizes this config with its own `XxIdentifierType`
 * (`ModelProjectionBaseConfig<E, KtIdentifierType>`) so `toIdentifierType`'s
 * return tightens to that language's `type` vocabulary — no recast. The
 * default keeps the loose `kind: string` boundary.
 */
export type ModelProjectionBaseConfig<
  EnrichmentType = undefined,
  IdType extends IdentifierType = IdentifierType
> = {
  id: string
  /** Pure: the cache-key name (the cache-check path runs this). */
  toIdentifierName: (args: ToModelIdentifierNameArgs<EnrichmentType>) => string
  /**
   * Context-aware, overridable: the non-`name` parts of the identifier
   * (`type` / `typeName` / `exported`), derived from the schema. Runs only
   * on cache-miss. Returns `IdType` — the veneer's `XxIdentifierType`, whose
   * `type` is bound to that language's `EntityType` vocabulary (the loose
   * `string` by default). The tightening rides the type argument.
   */
  toIdentifierType: (refName: RefName, context: GenerateContextType) => IdType
  toExportPath: (args: ToModelExportPathArgs<EnrichmentType>) => string
  /**
   * Required composite schema for the `{ subject, generator, stack }`
   * enrichment umbrella. Required (not optional) is load-bearing: it is what
   * lets `static toEnrichments` parse cast-free. A no-enrichment generator
   * passes `emptyEnrichmentSchema`.
   */
  toEnrichmentSchema: () => v.GenericSchema<EnrichmentType>
  /**
   * Optional: compute the DEFAULT enrichment values for a model from its schema
   * — the seed the CMS persists and the user then edits (vs {@link toEnrichments},
   * which READS already-authored values). Returns the `{ subject, generator,
   * stack }` umbrella; a generator typically fills only `subject` and leaves the
   * run-constant `generator` / `stack` scopes `undefined`. Omitted → the derived
   * static returns `undefined`.
   */
  toEnrichmentDefaults?: (args: ToEnrichmentsArgs) => EnrichmentType | undefined
  /**
   * Family-level applicability predicate. Becomes a static `isSupported`
   * on the returned base class so other projections can probe it before
   * `insertModel` (the model counterpart of the operation-reference
   * protocol). When omitted, advertises support for every model.
   */
  isSupported?: (args: { refName: RefName; context: GenerateContextType }) => boolean
}

/**
 * Build a model projection base class from a per-generator config.
 *
 * The returned class extends `base` — the generator's language
 * snippet base — so the projection hierarchy is language-bound at its root
 * while core stays language-blind (the base arrives as an opaque
 * constructor; core never names a concrete language class). The class
 * exposes the generator's `id`, `toIdentifierName`, `toIdentifierType`,
 * `toExportPath`, `toEnrichments`, and `isSupported` statics, inherits the
 * static `lang` from the base, and
 * injects `generatorKey` so subclasses don't have to.
 *
 * Defines NO `register` / `registerInto` — register ergonomics are typed by
 * each language's concise vocabulary, which core can't name, so they live
 * in the language package's projection-base veneer over this factory.
 *
 * The projection machinery previously hosted on `ModelProjectionBase` lives
 * here now, because the base class is no longer statically known.
 */
export const toModelProjectionBase = <
  EnrichmentType = undefined,
  IdType extends IdentifierType = IdentifierType
>(
  base: LangSnippetConstructor,
  config: ModelProjectionBaseConfig<EnrichmentType, IdType>
) => {
  return class extends base {
    static id = config.id
    static type = 'model' as const

    static toIdentifierName = config.toIdentifierName.bind(config)
    static toIdentifierType = config.toIdentifierType.bind(config)
    static toExportPath = config.toExportPath.bind(config)
    static toEnrichments = ({ refName, context, variant }: ToEnrichmentsArgs): EnrichmentType => {
      // The three enrichment scopes assembled into the umbrella a generator
      // reads off `this.settings.enrichments`. Subject is per-item
      // (`[id][refName][variant]`) — the variant axis is core-owned, and the
      // engine has already asserted `'main'` exists; generator and stack are
      // run-constants (`[id][_generator]`, `[_stack]`). The required composite
      // schema parses the raw umbrella once — typed, cast-free.
      const raw = {
        subject: get(context.settings, ['enrichments', config.id, refName, variant]),
        generator: get(context.settings, ['enrichments', config.id, GENERATOR_ENRICHMENT_KEY]),
        stack: get(context.settings, ['enrichments', STACK_ENRICHMENT_KEY])
      }

      return v.parse(config.toEnrichmentSchema(), raw)
    }

    /**
     * Derive the seed enrichment values for a model from its schema (the CMS
     * persists these, then the user edits). Returns `undefined` when the
     * generator declares no `toEnrichmentDefaults` — the common case.
     */
    static toEnrichmentDefaults = (args: ToEnrichmentsArgs): EnrichmentType | undefined =>
      config.toEnrichmentDefaults?.call(config, args)

    static isSupported = config.isSupported ?? (() => true)

    settings: ContentSettings<EnrichmentType>
    refName: RefName

    constructor(args: ModelProjectionArgs<EnrichmentType>) {
      super({
        context: args.context,
        generatorKey: toModelGeneratorKey({
          generatorId: config.id,
          refName: args.refName,
          variant: args.settings.variant ?? DEFAULT_VARIANT
        })
      })

      this.refName = args.refName
      this.settings = args.settings
    }

    /**
     * Insert a related model and return its `Inserted` reference. The
     * inserted model is exported to this projection's own `exportPath`
     * unless `noExport` is set.
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
     * Insert a related model with reference normalization. If `schema` is a
     * `$ref`, the referenced name is used; otherwise `fallbackName` applies.
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
