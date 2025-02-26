import type { GenerateContext } from '../../context/GenerateContext.ts'
import { toModelGeneratorKey } from '../../types/GeneratorKeys.ts'
import type { RefName } from '../../types/RefName.ts'
import type { ContentSettings } from '../ContentSettings.ts'
import { ModelBase } from './ModelBase.ts'
import type { Identifier } from '../Identifier.ts'
import { z } from 'zod'

export type ModelInsertableArgs<EnrichmentType = undefined> = {
  context: GenerateContext
  settings: ContentSettings<EnrichmentType>
  refName: RefName
}

type ToEnrichmentsArgs = {
  refName: RefName
  context: GenerateContext
}

export type BaseModelConfig<EnrichmentType = undefined> = {
  id: string
  toIdentifier: (refName: RefName) => Identifier
  toExportPath: (refName: RefName) => string
  toEnrichmentSchema?: () => z.ZodType<EnrichmentType>
}

export const toModelInsertable = <EnrichmentType = undefined>(
  config: BaseModelConfig<EnrichmentType>
) => {
  const ModelInsertable = class extends ModelBase<EnrichmentType> {
    static id = config.id
    static type = 'model' as const

    static toIdentifier = config.toIdentifier.bind(config)
    static toExportPath = config.toExportPath.bind(config)
    static toEnrichments = ({ refName, context }: ToEnrichmentsArgs): EnrichmentType => {
      const generatorSettings = context.toModelSettings({
        refName,
        generatorId: config.id
      })

      const enrichmentSchema = config.toEnrichmentSchema?.() ?? z.undefined()

      return enrichmentSchema.parse(generatorSettings.enrichments) as EnrichmentType
    }
    static isSupported = () => true

    constructor(args: ModelInsertableArgs<EnrichmentType>) {
      super({
        ...args,
        generatorKey: toModelGeneratorKey({
          generatorId: config.id,
          refName: args.refName
        })
      })
    }
  }

  return ModelInsertable
}
