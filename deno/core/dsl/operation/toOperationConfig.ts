import { z } from 'zod'
import type { OasOperation } from '../../oas/operation/Operation.ts'
import type { EnrichmentRequest } from '../../types/EnrichmentRequest.ts'
import type { IsSupportedArgs, TransformOperationArgs } from './types.ts'
import type { IsSupportedOperationConfigArgs } from './types.ts'
import type { SchemaOption } from '../../types/SchemaOptions.ts'
export type ToOperationConfigArgs<EnrichmentType = undefined, Acc = void> = {
  id: string
  transform: ({ context, operation, acc }: TransformOperationArgs<Acc>) => Acc
  toEnrichmentSchema?: () => z.ZodType<EnrichmentType>
  isSupported?: ({ context, operation }: IsSupportedOperationConfigArgs<EnrichmentType>) => boolean
  toSchemaOptions?: () => SchemaOption[]
  toEnrichmentRequest?: <RequestedEnrichment extends EnrichmentType>(
    operation: OasOperation
  ) => EnrichmentRequest<RequestedEnrichment> | undefined
}

export const toOperationConfig = <EnrichmentType = undefined, Acc = void>({
  id,
  transform,
  toEnrichmentSchema,
  isSupported,
  toSchemaOptions,
  toEnrichmentRequest
}: ToOperationConfigArgs<EnrichmentType, Acc>) => {
  return {
    id,
    type: 'operation',
    transform,
    toSchemaOptions,
    toEnrichmentSchema,
    isSupported: ({ context, operation }: IsSupportedArgs) => {
      if (!isSupported) {
        return true
      }

      const { enrichments } = context.toOperationSettings({
        generatorId: id,
        path: operation.path,
        method: operation.method
      })

      const enrichmentSchema = toEnrichmentSchema?.() ?? z.undefined()

      return isSupported({
        context,
        operation,
        enrichments: enrichmentSchema.parse(enrichments) as EnrichmentType
      })
    },
    toEnrichmentRequest
  }
}
