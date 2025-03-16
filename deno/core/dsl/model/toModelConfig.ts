import type { RefName } from '../../types/RefName.ts'
import type { EnrichmentRequest } from '../../types/EnrichmentRequest.ts'
import type { TransformModelArgs } from './types.ts'
import type { z } from 'zod'
import type { SchemaOption } from '../../types/SchemaOptions.ts'
type ToModelConfigArgs<EnrichmentType = undefined, Acc = void> = {
  id: string
  transform: ({ context, refName, acc }: TransformModelArgs<Acc>) => Acc
  toEnrichmentSchema?: () => z.ZodType<EnrichmentType>
  toSchemaOptions?: () => SchemaOption[]
  toEnrichmentRequest?: <RequestedEnrichment extends EnrichmentType>(
    refName: RefName
  ) => EnrichmentRequest<RequestedEnrichment> | undefined
}

export const toModelConfig = <EnrichmentType = undefined, Acc = void>({
  id,
  transform,
  toEnrichmentSchema,
  toSchemaOptions,
  toEnrichmentRequest
}: ToModelConfigArgs<EnrichmentType, Acc>) => {
  return {
    id,
    type: 'model',
    transform,
    toEnrichmentSchema,
    toSchemaOptions,
    toEnrichmentRequest
  }
}
