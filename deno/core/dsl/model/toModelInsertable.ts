import type { GenerateContext } from '../../context/GenerateContext.ts'
import { toModelGeneratorKey } from '../../types/GeneratorKeys.ts'
import type { RefName } from '../../types/RefName.ts'
import type { ContentSettings } from '../ContentSettings.ts'
import { ModelBase } from './ModelBase.ts'
import type { Identifier } from '../Identifier.ts'
import type { EnrichmentRequest } from '../../types/EnrichmentRequest.ts'
export type ModelInsertableArgs = {
  context: GenerateContext
  settings: ContentSettings
  refName: RefName
}

export type ModelConfig = {
  id: string
  toIdentifier: (refName: RefName) => Identifier
  toExportPath: (refName: RefName) => string
  toEnrichmentRequest?: (refName: RefName) => EnrichmentRequest | undefined
}

export const toModelInsertable = (config: ModelConfig) => {
  const ModelInsertable = class extends ModelBase {
    static id = config.id
    static type = 'model' as const
    static _class = 'ModelInsertable' as const

    static toIdentifier = config.toIdentifier.bind(config)
    static toExportPath = config.toExportPath.bind(config)
    static toEnrichmentRequest = config.toEnrichmentRequest?.bind(config)

    static isSupported = () => true

    static pinnable = false

    constructor(args: ModelInsertableArgs) {
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
