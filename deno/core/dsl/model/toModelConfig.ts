import type { RefName } from '../../types/RefName.ts'
import type { SchemaItem } from '../../types/SchemaItem.ts'
import type { EnrichmentRequest } from '../../types/EnrichmentRequest.ts'
import type { TransformModelArgs } from './types.ts'
import type { z } from 'zod'

type ToModelConfigArgs<EnrichmentType, Acc = void> = {
  id: string
  transform: ({ context, refName, acc }: TransformModelArgs<Acc>) => Acc
  toEnrichmentSchema: () => z.ZodType<EnrichmentType>
  toEnrichmentRequest?: <RequestedEnrichment extends EnrichmentType>(
    refName: RefName
  ) => EnrichmentRequest<RequestedEnrichment> | undefined

  toSchemaItem?: (refName: RefName) => SchemaItem
}

export const toModelConfig = <EnrichmentType, Acc = void>({
  id,
  transform,
  toEnrichmentSchema,
  toEnrichmentRequest,
  toSchemaItem
}: ToModelConfigArgs<EnrichmentType, Acc>) => {
  return {
    id,
    type: 'model',
    transform,
    toEnrichmentSchema,
    toEnrichmentRequest,
    toSchemaItem
  }
}
