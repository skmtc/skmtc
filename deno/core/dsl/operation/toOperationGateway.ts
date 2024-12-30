import type { OasOperation } from '../../oas/operation/Operation.ts'
import { GatewayBase, type OperationGatewayArgs } from '../GatewayBase.ts'
import type { Identifier } from '../Identifier.ts'
import type { EnrichmentRequest } from '../../types/EnrichmentRequest.ts'
import type { IsSupportedOperationArgs } from './OperationInsertable.ts'
import type { GenerateContext } from '../../context/GenerateContext.ts'
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
