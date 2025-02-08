import { toOperationGeneratorKey } from '../../types/GeneratorKeys.ts'
import type { GenerateContext } from '../../context/GenerateContext.ts'
import type { OasOperation } from '../../oas/operation/Operation.ts'
import { OperationBase } from './OperationBase.ts'
import type { Identifier } from '../Identifier.ts'
import type { EnrichmentRequest } from '../../types/EnrichmentRequest.ts'
import type {
  IsSupportedOperationConfigArgs,
  OperationInsertableArgs,
  IsSupportedOperationArgs
} from './OperationInsertable.ts'
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
