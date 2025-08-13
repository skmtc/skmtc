import type { RefName } from '../../types/RefName.ts'
import type { EnrichmentRequest } from '../../types/EnrichmentRequest.ts'
import type { TransformModelArgs, ToModelPreviewModuleArgs, ToModelMappingArgs } from './types.ts'
import type * as v from 'valibot'
import type { MappingModule, PreviewModule } from '../../types/Preview.ts'

type ToModelEntryArgs<EnrichmentType = undefined, Acc = void> = {
  id: string
  transform: ({ context, refName, acc }: TransformModelArgs<Acc>) => Acc
  toEnrichmentSchema?: () => v.GenericSchema<EnrichmentType>
  toPreviewModule?: ({ context, refName }: ToModelPreviewModuleArgs) => PreviewModule
  toMappingModule?: ({ context, refName }: ToModelMappingArgs) => MappingModule
  toEnrichmentRequest?: <RequestedEnrichment extends EnrichmentType>(
    refName: RefName
  ) => EnrichmentRequest<RequestedEnrichment> | undefined
}

export const toModelEntry = <EnrichmentType = undefined, Acc = void>({
  id,
  transform,
  toPreviewModule,
  toMappingModule,
  toEnrichmentSchema,
  toEnrichmentRequest
}: ToModelEntryArgs<EnrichmentType, Acc>) => {
  return {
    id,
    type: 'model',
    transform,
    toPreviewModule,
    toMappingModule,
    toEnrichmentSchema,
    toEnrichmentRequest
  }
}
