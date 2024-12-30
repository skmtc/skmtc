import type { GenerateContext } from '../../context/GenerateContext.ts'
import { toModelGeneratorKey } from '../../types/GeneratorKeys.ts'
import type { RefName } from '../../types/RefName.ts'
import type { ContentSettings } from '../ContentSettings.ts'
import { ModelBase } from './ModelBase.ts'
import type { Identifier } from '../Identifier.ts'
import type { EnrichmentRequest } from '../../types/EnrichmentRequest.ts'
import type { z } from 'zod'

export type ModelInsertableArgs<EnrichmentType> = {
  context: GenerateContext
  settings: ContentSettings<EnrichmentType>
  refName: RefName
}

type ToEnrichmentsArgs = {
  refName: RefName
  context: GenerateContext
}

export type ModelConfig<EnrichmentType> = {
  id: string
  toIdentifier: (refName: RefName) => Identifier
  toExportPath: (refName: RefName) => string
  toEnrichmentRequest?: (refName: RefName) => EnrichmentRequest<EnrichmentType> | undefined
  toEnrichmentSchema: () => z.ZodType<EnrichmentType>
}

export const toModelInsertable = <EnrichmentType>(config: ModelConfig<EnrichmentType>) => {
  const ModelInsertable = class extends ModelBase<EnrichmentType> {
    static id = config.id
    static type = 'model' as const
    static _class = 'ModelInsertable' as const

    static toIdentifier = config.toIdentifier.bind(config)
    static toExportPath = config.toExportPath.bind(config)
    static toEnrichmentRequest = config.toEnrichmentRequest?.bind(config)
    static toEnrichments = ({ refName, context }: ToEnrichmentsArgs): EnrichmentType => {
      const generatorSettings = context.toModelContentSettings({
        refName,
        insertable: this
      })

      return config.toEnrichmentSchema().parse(generatorSettings.enrichments)
    }
    static isSupported = () => true

    static pinnable = false

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
