import type { RefName } from '@/types/RefName.ts'
import type { EnrichmentRequest } from '@/types/EnrichmentRequest.ts'
import type { TransformModelArgs, ToModelPreviewModuleArgs, ToModelMappingArgs } from './types.ts'
import type * as v from 'valibot'
import type { MappingModule, PreviewModule } from '@/types/Preview.ts'

type ToModelEntryArgs<EnrichmentType = undefined> = {
  id: string
  transform: ({ context, refName, variant }: TransformModelArgs) => void
  toEnrichmentSchema?: () => v.GenericSchema<EnrichmentType>
  toPreviewModule?: ({ context, refName, variant }: ToModelPreviewModuleArgs) => PreviewModule
  toMappingModule?: ({ context, refName, variant }: ToModelMappingArgs) => MappingModule
  toEnrichmentRequest?: <RequestedEnrichment extends EnrichmentType>(
    refName: RefName
  ) => EnrichmentRequest<RequestedEnrichment> | undefined
}

/**
 * Creates a model transformation entry for the SKMTC pipeline.
 *
 * This function creates a standardized model entry that defines how to transform
 * OpenAPI schema objects into model artifacts. Model entries are used by the
 * generation pipeline to process schemas and create output files.
 *
 * The resulting entry includes transformation logic, preview generation,
 * mapping generation, enrichment handling, and schema validation.
 *
 * @template EnrichmentType - Type of enrichments that can be applied to models
 * @param args - Configuration for the model entry
 * @param args.id - Unique identifier for this model entry
 * @param args.transform - Function to transform schemas into artifacts
 * @param args.toPreviewModule - Optional function to generate preview modules
 * @param args.toMappingModule - Optional function to generate mapping modules
 * @param args.toEnrichmentSchema - Optional function to provide enrichment validation
 * @param args.toEnrichmentRequest - Optional function to request enrichments
 * @returns Model entry object for use in the generation pipeline
 *
 * @example Basic model entry
 * ```typescript
 * import { toModelEntry } from '@skmtc/core';
 *
 * const typeScriptModelEntry = toModelEntry({
 *   id: 'typescript-models',
 *   transform: ({ context, refName }) => {
 *     context.insertModel(TsModel, refName);
 *   },
 *   toPreviewModule: ({ context, refName }) => ({
 *     group: 'forms',
 *     title: `${refName} Model`,
 *     description: 'Generated TypeScript interface'
 *   })
 * });
 * ```
 *
 * @example Model entry with enrichments
 * ```typescript
 * const validationModelEntry = toModelEntry({
 *   id: 'validation-schemas',
 *   transform: ({ context, refName }) => {
 *     context.insertModel(ValidationModel, refName);
 *   },
 *   toEnrichmentSchema: () => v.object({
 *     strict: v.optional(v.boolean()),
 *     nullable: v.optional(v.boolean())
 *   }),
 *   toEnrichmentRequest: (refName) => ({
 *     path: `models.${refName}`,
 *     schema: enrichmentSchema
 *   })
 * });
 * ```
 */
export const toModelEntry = <EnrichmentType = undefined>({
  id,
  transform,
  toPreviewModule,
  toMappingModule,
  toEnrichmentSchema,
  toEnrichmentRequest
}: ToModelEntryArgs<EnrichmentType>): {
  id: string
  type: 'model'
  transform: ({ context, refName, variant }: TransformModelArgs) => void
  toPreviewModule?: ({ context, refName, variant }: ToModelPreviewModuleArgs) => PreviewModule
  toMappingModule?: ({ context, refName, variant }: ToModelMappingArgs) => MappingModule
  toEnrichmentSchema?: () => v.GenericSchema<EnrichmentType>
  toEnrichmentRequest?: <RequestedEnrichment extends EnrichmentType>(
    refName: RefName
  ) => EnrichmentRequest<RequestedEnrichment> | undefined
} => {
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
