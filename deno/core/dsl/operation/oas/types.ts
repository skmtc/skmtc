import type { OasOperation } from '@/oas/operation/Operation.ts'
import type { ContentSettings } from '@/dsl/ContentSettings.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import type { Identifier } from '@/dsl/Identifier.ts'
import type { EnrichmentRequest } from '@/types/EnrichmentRequest.ts'
import type * as v from 'valibot'
import type { MappingModule, PreviewModule } from '@/types/Preview.ts'

/**
 * External constructor signature for an OAS operation projection class.
 *
 * The pipeline calls `new SomeProjection(args)` with this shape; the
 * runtime base class injects `generatorKey` before calling `super()`.
 */
export type OasOperationProjectionConstructorArgs<EnrichmentType = undefined> = {
  context: GenerateContextType
  settings: ContentSettings<EnrichmentType>
  operation: OasOperation
}

export type TransformOasOperationArgs<Acc> = {
  context: GenerateContextType
  operation: OasOperation
  acc: Acc | undefined
}

export type WithTransformOasOperation = {
  transformOperation: (operation: OasOperation) => void
}

export type IsSupportedOasOperationConfigArgs<EnrichmentType = undefined> = {
  context: GenerateContextType
  operation: OasOperation
  enrichments: EnrichmentType
}

export type IsSupportedOasOperationArgs = {
  context: GenerateContextType
  operation: OasOperation
}

export type ToOasOperationEnrichmentsArgs = {
  operation: OasOperation
  context: GenerateContextType
}

export type ToOasOperationPreviewModuleArgs = {
  context: GenerateContextType
  operation: OasOperation
}

export type ToOasOperationMappingArgs = {
  context: GenerateContextType
  operation: OasOperation
}

/**
 * Static structural type of an OAS operation projection class.
 *
 * Captures both the instance side (`new(...) => V`) and the static side
 * (`id`, `toIdentifier`, `toExportPath`, `toEnrichments`). Passed as a
 * type parameter to `context.insertOperation(...)`.
 */
export type ToOasOperationIdentifierArgs<EnrichmentType = undefined> = {
  operation: OasOperation
  enrichments: EnrichmentType
}

export type ToOasOperationExportPathArgs<EnrichmentType = undefined> = {
  operation: OasOperation
  enrichments: EnrichmentType
}

export type OasOperationProjection<V, EnrichmentType = undefined> = { prototype: V } & {
  new ({
    context,
    settings,
    operation
  }: OasOperationProjectionConstructorArgs<EnrichmentType>): V
  id: string
  type: 'oasOperation'
  toIdentifier: (args: ToOasOperationIdentifierArgs<EnrichmentType>) => Identifier
  toExportPath: (args: ToOasOperationExportPathArgs<EnrichmentType>) => string
  toEnrichments: ({ operation, context }: ToOasOperationEnrichmentsArgs) => EnrichmentType
  // deno-lint-ignore ban-types
} & Function

/**
 * Pipeline-side configuration for an OAS operation projection (built by
 * `toOasOperationEntry`).
 */
export type OasOperationConfig<EnrichmentType = undefined> = {
  id: string
  type: 'oasOperation'
  transform: <Acc = void>({ context, operation, acc }: TransformOasOperationArgs<Acc>) => Acc
  toEnrichmentSchema?: () => v.GenericSchema<EnrichmentType>
  isSupported: ({ context, operation }: IsSupportedOasOperationArgs) => boolean
  toPreviewModule?: ({ context, operation }: ToOasOperationPreviewModuleArgs) => PreviewModule
  toMappingModule?: ({ context, operation }: ToOasOperationMappingArgs) => MappingModule
  toEnrichmentRequest?: <RequestedEnrichment extends EnrichmentType>(
    operation: OasOperation
  ) => EnrichmentRequest<RequestedEnrichment> | undefined
}
