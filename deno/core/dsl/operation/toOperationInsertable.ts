import { toOperationGeneratorKey } from '../../types/GeneratorKeys.ts'
import type { GenerateContext } from '../../context/GenerateContext.ts'
import type { OasOperation } from '../../oas/operation/Operation.ts'
import type { ContentSettings } from '../ContentSettings.ts'
import { OperationBase } from './OperationBase.ts'
import type { Identifier } from '../Identifier.ts'
import type { EnrichmentRequest } from '../../types/EnrichmentRequest.ts'
import type { IsSupportedOperationArgs } from './OperationInsertable.ts'

export type OperationInsertableArgs<EnrichmentType> = {
  context: GenerateContext
  settings: ContentSettings<EnrichmentType>
  operation: OasOperation
}

export type ToOperationInsertableArgs<EnrichmentType> = {
  id: string
  toIdentifier: (operation: OasOperation) => Identifier
  toExportPath: (operation: OasOperation) => string
  isSupported?: ({ operation, enrichments }: IsSupportedOperationArgs<EnrichmentType>) => boolean
  toEnrichmentRequest?: (operation: OasOperation) => EnrichmentRequest<EnrichmentType> | undefined
  toEnrichments?: (value: unknown) => EnrichmentType
  pinnable?: boolean
}

export const toOperationInsertable = <EnrichmentType>(
  config: ToOperationInsertableArgs<EnrichmentType>
) => {
  const OperationInsertable = class extends OperationBase<EnrichmentType> {
    static id = config.id
    static type = 'operation' as const
    static _class = 'OperationInsertable' as const

    static toIdentifier = config.toIdentifier.bind(config)
    static toExportPath = config.toExportPath.bind(config)
    static toEnrichmentRequest = config.toEnrichmentRequest?.bind(config)
    static toEnrichments = config.toEnrichments?.bind(config)

    static isSupported = config.isSupported ?? (() => true)

    static pinnable = config.pinnable ?? false

    constructor(args: OperationInsertableArgs<EnrichmentType>) {
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
