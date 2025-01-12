import { toOperationGeneratorKey } from '../../types/GeneratorKeys.js'
import type { GenerateContext } from '../../context/GenerateContext.js'
import type { OasOperation } from '../../oas/operation/Operation.js'
import { OperationBase } from './OperationBase.js'
import type { Identifier } from '../Identifier.js'
import type { EnrichmentRequest } from '../../types/EnrichmentRequest.js'
import type {
  IsSupportedOperationConfigArgs,
  OperationInsertableArgs,
  IsSupportedOperationArgs
} from './OperationInsertable.js'
import type { z } from 'zod'

export type ToOperationInsertableArgs<EnrichmentType> = {
  id: string
  toIdentifier: (operation: OasOperation) => Identifier
  toExportPath: (operation: OasOperation) => string
  isSupported?: ({
    context,
    operation,
    enrichments
  }: IsSupportedOperationConfigArgs<EnrichmentType>) => boolean
  toEnrichmentRequest?: <RequestedEnrichment extends EnrichmentType>(
    operation: OasOperation
  ) => EnrichmentRequest<RequestedEnrichment> | undefined
  toEnrichmentSchema: () => z.ZodType<EnrichmentType>
  pinnable?: boolean
}

type ToEnrichmentsArgs = {
  operation: OasOperation
  context: GenerateContext
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

    static isSupported = ({ context, operation }: IsSupportedOperationArgs) => {
      if (typeof config.isSupported !== 'function') {
        return true
      }

      const enrichments = OperationInsertable.toEnrichments({ operation, context })

      return config.isSupported({ context, operation, enrichments })
    }

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
