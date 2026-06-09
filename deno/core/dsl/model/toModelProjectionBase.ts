import type { GenerateContextType } from '../../context/generateTypes.ts'
import { toModelGeneratorKey } from '@/dsl/GeneratorKeys.ts'
import type { RefName } from '@/types/RefName.ts'
import type { ContentSettings } from '@/dsl/ContentSettings.ts'
import { ModelProjectionBase } from '@/dsl/model/ModelProjectionBase.ts'
import type { Identifier } from '@/dsl/Identifier.ts'
import type { Lang } from '@/dsl/Lang.ts'
import type {
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
 * The factory injects `generatorKey` before delegating to
 * {@link ModelProjectionBase}, so user code only supplies these three
 * fields.
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
  id: string
  /**
   * The target language for this generator — a `@skmtc/lang-*` package's
   * `Lang` (e.g. `typescript`). Required: it fixes the language at the
   * projection base, so a projection cannot be built without one. The
   * factory exposes it as `static lang` (the Driver reads it) and injects
   * it as the instance `lang` (the register methods use it).
   */
  lang: Lang
  toIdentifier: (args: ToModelIdentifierArgs<EnrichmentType>) => Identifier
  toExportPath: (args: ToModelExportPathArgs<EnrichmentType>) => string
  toEnrichmentSchema?: () => v.BaseSchema<EnrichmentType, EnrichmentType, v.BaseIssue<unknown>>
}

/**
 * Build a model projection base class from a per-generator config.
 *
 * The returned class extends {@link ModelProjectionBase}, exposes the
 * generator's `id`, `toIdentifier`, `toExportPath`, and `toEnrichments`
 * statics, and injects `generatorKey` so subclasses don't have to.
 */
export const toModelProjectionBase = <EnrichmentType = undefined>(
  config: ModelProjectionBaseConfig<EnrichmentType>
) => {
  return class extends ModelProjectionBase<EnrichmentType> {
    static id = config.id
    static type = 'model' as const
    static lang: Lang = config.lang

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

    constructor(args: ModelProjectionArgs<EnrichmentType>) {
      super({
        ...args,
        lang: config.lang,
        generatorKey: toModelGeneratorKey({
          generatorId: config.id,
          refName: args.refName,
          variant: args.settings.variant ?? DEFAULT_VARIANT
        })
      })
    }
  }
}
