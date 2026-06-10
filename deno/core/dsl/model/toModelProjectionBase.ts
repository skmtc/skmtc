import type { GenerateContextType } from '../../context/generateTypes.ts'
import type {
  BaseRegisterArgs,
  InsertModelOptions,
  InsertNormalizedModelArgs,
  InsertNormalizedModelReturn
} from '../../context/generateTypes.ts'
import { toModelGeneratorKey } from '@/dsl/GeneratorKeys.ts'
import type { RefName } from '@/types/RefName.ts'
import type { ContentSettings } from '@/dsl/ContentSettings.ts'
import type { LangSnippetConstructor } from '@/dsl/Lang.ts'
import { registerViaLang } from '@/dsl/langRegister.ts'
import type { Identifier } from '@/dsl/Identifier.ts'
import type { GeneratedValue } from '@/dsl/GeneratedValue.ts'
import type { Inserted } from '@/dsl/Inserted.ts'
import type { OasSchema } from '@/oas/schema/Schema.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import type { OasVoid } from '@/oas/void/Void.ts'
import type {
  ModelProjection,
  ToModelIdentifierArgs,
  ToModelExportPathArgs
} from '@/dsl/model/types.ts'
import * as v from 'valibot'
import { DEFAULT_VARIANT } from '@/types/Variant.ts'
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
 */
export type ModelProjectionBaseConfig<EnrichmentType = undefined> = {
  /**
   * The language snippet base the projection class is built on — a
   * `@skmtc/lang-*` package's snippet base (e.g. `TsSnippet`). This is where
   * language enters the class hierarchy: the base carries `lang` on both the
   * static side (read by Drivers, pre-construction) and the instance side
   * (used by the register methods). SPIKE (option 2 — see `notes/lang/14`).
   */
  base: LangSnippetConstructor
  id: string
  toIdentifier: (args: ToModelIdentifierArgs<EnrichmentType>) => Identifier
  toExportPath: (args: ToModelExportPathArgs<EnrichmentType>) => string
  toEnrichmentSchema?: () => v.BaseSchema<EnrichmentType, EnrichmentType, v.BaseIssue<unknown>>
}

/**
 * Build a model projection base class from a per-generator config.
 *
 * The returned class extends `config.base` — the generator's language
 * snippet base — so the projection hierarchy is language-bound at its root
 * while core stays language-blind (the base arrives as an opaque
 * constructor; core never names a concrete language class). The class
 * exposes the generator's `id`, `toIdentifier`, `toExportPath`, and
 * `toEnrichments` statics, inherits `lang` (static + instance) from the
 * base, and injects `generatorKey` so subclasses don't have to.
 *
 * The projection machinery previously hosted on `ModelProjectionBase` lives
 * here now, because the base class is no longer statically known.
 */
export const toModelProjectionBase = <EnrichmentType = undefined>(
  config: ModelProjectionBaseConfig<EnrichmentType>
) => {
  return class extends config.base {
    static id = config.id
    static type = 'model' as const

    static toIdentifier = config.toIdentifier.bind(config)
    static toExportPath = config.toExportPath.bind(config)
    static toEnrichments = ({ refName, context, variant }: ToEnrichmentsArgs): EnrichmentType => {
      // The variant axis is owned by core: consumer enrichments are keyed
      // `[generatorId][refName][variant]`, and the generator's own schema
      // describes the per-variant inner value. The engine has already
      // enumerated valid variants and asserted `'main'` exists, so the
      // lookup here either hits a declared variant or — for the synthetic
      // single-`'main'` pass when no enrichments are configured — returns
      // `undefined`, which the Valibot schema accepts via its
      // `v.optional(...)` envelope.
      const modelEnrichments = get(
        context.settings,
        `enrichments.${config.id}.${refName}.${variant}`
      )

      const enrichmentSchema = config.toEnrichmentSchema?.() ?? v.optional(v.unknown())

      return v.parse(enrichmentSchema, modelEnrichments) as EnrichmentType
    }
    static isSupported = () => true

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

    /**
     * Register imports/definitions in this projection's **own** export file
     * (`this.settings.exportPath`), through this projection's own `lang`
     * (inherited from the language snippet base) — no `generatorId`
     * resolution involved. For a different file use {@link registerInto}.
     */
    override register(args: BaseRegisterArgs): void {
      registerViaLang(this, { ...args, destinationPath: this.settings.exportPath })
    }

    /**
     * Register imports/definitions into an explicitly named file
     * (`destinationPath`) — distinct from {@link register}, which always
     * targets this projection's own export file.
     */
    registerInto(destinationPath: string, args: BaseRegisterArgs): void {
      registerViaLang(this, { ...args, destinationPath })
    }
  }
}
