import { toOperationGeneratorKey } from '../../types/GeneratorKeys.ts'
import type { GenerateContext } from '../../context/GenerateContext.ts'
import type { OasOperation } from '../../oas/operation/Operation.ts'
import type { ContentSettings } from '../ContentSettings.ts'
import { OperationBase } from './OperationBase.ts'
import type { Identifier } from '../Identifier.ts'
import type { EnrichmentRequest } from '../../types/EnrichmentRequest.ts'

export type OperationInsertableArgs = {
  context: GenerateContext
  settings: ContentSettings
  operation: OasOperation
}

export type ToOperationInsertableArgs = {
  id: string
  toIdentifier: (operation: OasOperation) => Identifier
  toExportPath: (operation: OasOperation) => string
  isSupported?: (operation: OasOperation) => boolean
  toEnrichmentRequest?: (operation: OasOperation) => EnrichmentRequest
  pinnable?: boolean
}

export const toOperationInsertable = (config: ToOperationInsertableArgs) => {
  const OperationInsertable = class extends OperationBase {
    static id = config.id
    static type = 'operation' as const
    static _class = 'OperationInsertable' as const

    static toIdentifier = config.toIdentifier.bind(config)
    static toExportPath = config.toExportPath.bind(config)
    static toEnrichmentRequest = config.toEnrichmentRequest?.bind(config)

    static isSupported = config.isSupported ?? (() => true)

    static pinnable = config.pinnable ?? false

    constructor(args: OperationInsertableArgs) {
      super({
        ...args,
        generatorKey: toOperationGeneratorKey({
          generatorId: config.id,
          operation: args.operation
        })
      })
    }
  }

  return OperationInsertable
}
