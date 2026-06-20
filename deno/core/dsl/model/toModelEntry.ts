import type { RefName } from '@/types/RefName.ts'
import type { EnrichmentRequest } from '@/types/EnrichmentRequest.ts'
import type {
  TransformModelArgs,
  ToModelPreviewModuleArgs,
  ToModelMappingArgs,
  ToModelEnrichmentsArgs,
  IsSupportedModelArgs,
  IsSupportedModelConfigArgs
} from './types.ts'
import * as v from 'valibot'
import type { MappingModule, PreviewModule } from '@/types/Preview.ts'
import { GENERATOR_ENRICHMENT_KEY, STACK_ENRICHMENT_KEY } from '@/types/Enrichments.ts'
// @deno-types="npm:@types/lodash-es@4.17.12/get.d.ts"
import get from 'lodash-es/get'

type ToModelEntryArgs<EnrichmentType = undefined> = {
  id: string
  transform: ({ context, refName, variant }: TransformModelArgs) => void
  toEnrichmentSchema: () => v.GenericSchema<EnrichmentType>
  isSupported?: ({ context, refName }: IsSupportedModelConfigArgs<EnrichmentType>) => boolean
  toPreviewModule?: ({ context, refName, variant }: ToModelPreviewModuleArgs) => PreviewModule
  toMappingModule?: ({ context, refName, variant }: ToModelMappingArgs) => MappingModule
  toEnrichmentRequest?: <RequestedEnrichment extends EnrichmentType>(
    refName: RefName
  ) => EnrichmentRequest<RequestedEnrichment> | undefined
  toEnrichmentDefaults?: ({
    refName,
    context,
    variant
  }: ToModelEnrichmentsArgs) => EnrichmentType | undefined
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
 * @param args.isSupported - Optional capability gate; a model whose predicate
 *   returns `false` is recorded `notSupported` and its `transform` is skipped.
 *   Resolve the schema inside the predicate when needed
 *   (`context.resolveSchemaRefOnce(refName, id)`). Defaults to supporting every model.
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
  isSupported,
  toPreviewModule,
  toMappingModule,
  toEnrichmentSchema,
  toEnrichmentRequest,
  toEnrichmentDefaults
}: ToModelEntryArgs<EnrichmentType>): {
  id: string
  type: 'model'
  transform: ({ context, refName, variant }: TransformModelArgs) => void
  isSupported: ({ context, refName }: IsSupportedModelArgs) => boolean
  toPreviewModule?: ({ context, refName, variant }: ToModelPreviewModuleArgs) => PreviewModule
  toMappingModule?: ({ context, refName, variant }: ToModelMappingArgs) => MappingModule
  toEnrichmentSchema: () => v.GenericSchema<EnrichmentType>
  toEnrichmentRequest?: <RequestedEnrichment extends EnrichmentType>(
    refName: RefName
  ) => EnrichmentRequest<RequestedEnrichment> | undefined
  toEnrichmentDefaults?: ({
    refName,
    context,
    variant
  }: ToModelEnrichmentsArgs) => EnrichmentType | undefined
} => {
  return {
    id,
    type: 'model',
    transform,
    isSupported: ({ context, refName, variant }: IsSupportedModelArgs) => {
      if (!isSupported) {
        return true
      }

      // Assemble the three-scope umbrella — mirrors
      // `ModelProjectionBase.toEnrichments` so the shim and the
      // projection-base resolve to the same value. Subject is per-item
      // (`[id][refName][variant]`); generator and stack are run-constants.
      // The required composite schema parses cast-free.
      const raw = {
        subject: get(context.settings, ['enrichments', id, refName, variant]),
        generator: get(context.settings, ['enrichments', id, GENERATOR_ENRICHMENT_KEY]),
        stack: get(context.settings, ['enrichments', STACK_ENRICHMENT_KEY])
      }

      return isSupported({
        context,
        refName,
        enrichments: v.parse(toEnrichmentSchema(), raw),
        variant
      })
    },
    toPreviewModule,
    toMappingModule,
    toEnrichmentSchema,
    toEnrichmentRequest,
    toEnrichmentDefaults
  }
}
