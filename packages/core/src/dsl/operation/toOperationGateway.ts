import type { OasOperation } from '../../oas/operation/Operation.js'
import { GatewayBase, type OperationGatewayArgs } from '../GatewayBase.js'
import type { Identifier } from '../Identifier.js'
import type { EnrichmentRequest } from '../../types/EnrichmentRequest.js'
import type { IsSupportedOperationArgs } from './OperationInsertable.js'
import type { GenerateContext } from '../../context/GenerateContext.js'
import type { z } from 'zod'

export type ToOperationGatewayArgs<EnrichmentType> = {
  id: string
  toIdentifier: () => Identifier
  toExportPath: () => string
  isSupported?: ({
    operation,
    enrichments,
    context
  }: IsSupportedOperationArgs<EnrichmentType>) => boolean
  toEnrichmentRequest?: (operation: OasOperation) => EnrichmentRequest<EnrichmentType> | undefined
  toEnrichmentSchema: () => z.ZodType<EnrichmentType>
}

type ToEnrichmentsArgs = {
  operation: OasOperation
  context: GenerateContext
}

export const toOperationGateway = <EnrichmentType>(
  config: ToOperationGatewayArgs<EnrichmentType>
) => {
  const OperationGateway = class extends GatewayBase {
    static id = config.id
    static type = 'operation' as const
    static _class = 'OperationGateway' as const

    static toIdentifier = config.toIdentifier.bind(config)
    static toExportPath = config.toExportPath.bind(config)
    static toEnrichmentRequest = config.toEnrichmentRequest?.bind(config)
    static toEnrichmentSchema = config.toEnrichmentSchema.bind(config)

    static toEnrichments = ({ operation, context }: ToEnrichmentsArgs): EnrichmentType => {
      const generatorSettings = context.toOperationSettings({
        generatorId: config.id,
        path: operation.path,
        method: operation.method
      })

      const responseSchema = config.toEnrichmentSchema?.()

      return responseSchema?.parse(generatorSettings.enrichments)
    }
    static isSupported = config.isSupported ?? (() => true)

    static pinnable = false

    constructor({ context, settings }: OperationGatewayArgs) {
      super({ context, settings })
    }
  }

  return OperationGateway
}
