import type { GenerateContext } from '../../context/GenerateContext.js'
import { toModelGeneratorKey } from '../../types/GeneratorKeys.js'
import type { RefName } from '../../types/RefName.js'
import type { ContentSettings } from '../ContentSettings.js'
import { ModelBase } from './ModelBase.js'
import type { Identifier } from '../Identifier.js'

export type ModelInsertableArgs = {
  context: GenerateContext
  settings: ContentSettings
  refName: RefName
}

export type ModelConfig = {
  id: string
  toIdentifier: (refName: RefName) => Identifier
  toExportPath: (refName: RefName) => string
}

export const toModelInsertable = (config: ModelConfig) => {
  const ModelInsertable = class extends ModelBase {
    static id = config.id
    static type = 'model' as const
    static _class = 'ModelInsertable' as const

    static toIdentifier = config.toIdentifier.bind(config)
    static toExportPath = config.toExportPath.bind(config)

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
