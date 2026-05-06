import type { OasOperation } from '@/oas/operation/Operation.ts'
import type { ContentSettings } from '@/dsl/ContentSettings.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import type { Identifier } from '@/dsl/Identifier.ts'
import type { EnrichmentRequest } from '@/types/EnrichmentRequest.ts'
import type * as v from 'valibot'
import type { MappingModule, PreviewModule } from '@/types/Preview.ts'
/**
 * Arguments passed to operation insertable constructors.
 *
 * @template EnrichmentType - Optional enrichment data type for additional metadata
 */
export type OasOperationInsertableArgs<EnrichmentType = undefined> = {
  context: GenerateContextType
  settings: ContentSettings<EnrichmentType>
  operation: OasOperation
}

/**
 * Arguments passed to operation transformation functions.
 *
 * @template Acc - Accumulator type for collecting transformation results
 */
export type TransformOasOperationArgs<Acc> = {
  context: GenerateContextType
  operation: OasOperation
  acc: Acc | undefined
}

/**
 * Interface for objects that provide operation transformation capabilities.
 *
 * Used by generator configurations to transform operation definitions
 * during the code generation process.
 */
export type WithTransformOasOperation = {
  transformOperation: (operation: OasOperation) => void
}

/**
 * Arguments for checking if an operation is supported with enrichment configuration.
 *
 * @template EnrichmentType - Optional enrichment data type for additional metadata
 */
export type IsSupportedOasOperationConfigArgs<EnrichmentType = undefined> = {
  context: GenerateContextType
  operation: OasOperation
  enrichments: EnrichmentType
}

/**
 * Arguments for checking if an operation is supported for code generation.
 */
export type IsSupportedOasOperationArgs = {
  context: GenerateContextType
  operation: OasOperation
}

/**
 * Arguments for generating enrichment data for operations.
 */
export type ToOasOperationEnrichmentsArgs = {
  operation: OasOperation
  context: GenerateContextType
}

/**
 * Arguments for generating operation preview modules.
 *
 * Preview modules provide quick insights into generated operations
 * without full code generation.
 */
export type ToOasOperationPreviewModuleArgs = {
  context: GenerateContextType
  operation: OasOperation
}

/**
 * Arguments for generating operation mapping information.
 *
 * Mappings track relationships between OAS operations and generated code,
 * enabling cross-references and dependency analysis.
 */
export type ToOasOperationMappingArgs = {
  context: GenerateContextType
  operation: OasOperation
}

/**
 * Configuration object for insertable operation generators.
 *
 * Defines the contract for operation generator classes that can be inserted
 * into the generation context to produce type-safe operation definitions.
 *
 * @template V - Generated value type produced by the operation generator
 * @template EnrichmentType - Optional enrichment data type for additional metadata
 */
export type OasOperationInsertable<V, EnrichmentType = undefined> = { prototype: V } & {
  new ({ context, settings, operation }: OasOperationInsertableArgs<EnrichmentType>): V
  id: string
  type: 'oasOperation'
  toIdentifier: (operation: OasOperation) => Identifier
  toExportPath: (operation: OasOperation) => string
  toEnrichments: ({ operation, context }: ToOasOperationEnrichmentsArgs) => EnrichmentType
  // deno-lint-ignore ban-types
} & Function

/**
 * Configuration object for operation generators.
 *
 * Defines the behavior and capabilities of operation generators including
 * support detection, transformation logic, and enrichment handling.
 *
 * @template EnrichmentType - Optional enrichment data type for additional metadata
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
