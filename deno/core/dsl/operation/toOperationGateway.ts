import type { OasOperation } from '../../oas/operation/Operation.ts'
import { GatewayBase, type OperationGatewayArgs } from '../GatewayBase.ts'
import type { Identifier } from '../Identifier.ts'
import type { EnrichmentRequest } from '../../types/EnrichmentRequest.ts'
import type { IsSupportedOperationArgs } from './OperationInsertable.ts'

export type ToOperationGatewayArgs<EnrichmentType> = {
  id: string
  toIdentifier: () => Identifier
  toExportPath: () => string
  isSupported?: ({ operation, enrichments }: IsSupportedOperationArgs<EnrichmentType>) => boolean
  toEnrichmentRequest?: ({
    operation,
    enrichments
  }: IsSupportedOperationArgs<EnrichmentType>) => EnrichmentRequest<EnrichmentType> | undefined
  toEnrichments?: (operation: OasOperation) => EnrichmentType | undefined
}

export const toOperationGateway = <EnrichmentType>(
  config: ToOperationGatewayArgs<EnrichmentType>
) => {
  const OperationGateway = class extends GatewayBase<EnrichmentType> {
    static id = config.id
    static type = 'operation' as const
    static _class = 'OperationGateway' as const

    static toIdentifier = config.toIdentifier.bind(config)
    static toExportPath = config.toExportPath.bind(config)
    static toEnrichmentRequest = config.toEnrichmentRequest?.bind(config)
    static toEnrichments = config.toEnrichments?.bind(config)
    static isSupported = config.isSupported ?? (() => true)

    static pinnable = false

    constructor({ context, settings }: OperationGatewayArgs<EnrichmentType>) {
      super({ context, settings })
    }
  }

  return OperationGateway
}
