import { toOperationGeneratorKey } from '../../types/GeneratorKeys.ts'
import type { GenerateContext } from '../../context/GenerateContext.ts'
import type { OasOperation } from '../../oas/operation/Operation.ts'
import type { ContentSettings } from '../ContentSettings.ts'
import { OperationBase } from './OperationBase.ts'
import type { Identifier } from '../Identifier.ts'
import type { EnrichmentRequest } from '../../types/EnrichmentRequest.ts'
import type { IsSupportedOperationArgs } from './OperationInsertable.ts'
import type { z } from 'zod'

export type OperationInsertableArgs<EnrichmentType> = {
  context: GenerateContext
  settings: ContentSettings<EnrichmentType>
  operation: OasOperation
}

export type ToOperationInsertableArgs<EnrichmentType> = {
  id: string
  toIdentifier: (operation: OasOperation) => Identifier
  toExportPath: (operation: OasOperation) => string
  isSupported?: ({
    operation,
    enrichments,
    context
  }: IsSupportedOperationArgs<EnrichmentType>) => boolean
  toEnrichmentRequest?: (operation: OasOperation) => EnrichmentRequest<EnrichmentType> | undefined
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
