import type { GenerateContextType } from '../../context/generateTypes.ts'
import { toModelGeneratorKey } from '@/dsl/GeneratorKeys.ts'
import type { RefName } from '@/types/RefName.ts'
import type { ContentSettings } from '@/dsl/ContentSettings.ts'
import { ModelProjectionBase } from '@/dsl/model/ModelProjectionBase.ts'
import type { Identifier } from '@/dsl/Identifier.ts'
import type {
  ToModelIdentifierArgs,
  ToModelExportPathArgs
} from '@/dsl/model/types.ts'
import * as v from 'valibot'
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
}

/**
 * Configuration for {@link toModelProjectionBase}.
 */
export type ModelProjectionBaseConfig<EnrichmentType = undefined> = {
  id: string
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

    static toIdentifier = config.toIdentifier.bind(config)
    static toExportPath = config.toExportPath.bind(config)
    static toEnrichments = ({ refName, context }: ToEnrichmentsArgs): EnrichmentType => {
      const modelEnrichments = get(context.settings, `enrichments.${config.id}.${refName}`)

      const enrichmentSchema = config.toEnrichmentSchema?.() ?? v.undefined()

      return v.parse(enrichmentSchema, modelEnrichments) as EnrichmentType
    }
    static isSupported = () => true

    constructor(args: ModelProjectionArgs<EnrichmentType>) {
      super({
        ...args,
        generatorKey: toModelGeneratorKey({
          generatorId: config.id,
          refName: args.refName
        })
      })
    }
  }
}
