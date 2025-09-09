import type { GenerateContext } from '../../context/GenerateContext.ts'
import type { ContentSettings } from '../ContentSettings.ts'
import type { RefName } from '../../types/RefName.ts'
import type { Identifier } from '../Identifier.ts'
import type { EnrichmentRequest } from '../../types/EnrichmentRequest.ts'
import type * as v from 'valibot'
import type { MappingModule, PreviewModule } from '../../types/Preview.ts'
import type { SchemaToValueFn } from '../../types/TypeSystem.ts'

/**
 * Constructor arguments for model insertable instances.
 *
 * @template EnrichmentType - Optional enrichment data type for additional metadata
 */
export type ModelInsertableConstructorArgs<EnrichmentType = undefined> = {
  context: GenerateContext
  refName: RefName
  settings: ContentSettings<EnrichmentType>
  destinationPath: string
  rootRef?: RefName
}

/**
 * Interface for objects that provide model transformation capabilities.
 *
 * Used by generator configurations to transform model definitions
 * during the code generation process.
 */
export type WithTransformModel = {
  transformModel: (refName: RefName) => void
}

/**
 * Arguments for generating enrichment data for models.
 */
export type ToModelEnrichmentsArgs = {
  refName: RefName
  context: GenerateContext
}

/**
 * Arguments passed to model transformation functions.
 *
 * @template Acc - Accumulator type for collecting transformation results
 */
export type TransformModelArgs<Acc> = {
  context: GenerateContext
  refName: RefName
  acc: Acc | undefined
}

/**
 * Arguments for generating model preview modules.
 *
 * Preview modules provide quick insights into generated models
 * without full code generation.
 */
export type ToModelPreviewModuleArgs = {
  context: GenerateContext
  refName: RefName
}

/**
 * Arguments for generating model mapping information.
 *
 * Mappings track relationships between OAS schemas and generated models,
 * enabling cross-references and dependency analysis.
 */
export type ToModelMappingArgs = {
  context: GenerateContext
  refName: RefName
}

/**
 * Configuration object for insertable model generators.
 *
 * Defines the contract for model generator classes that can be inserted
 * into the generation context to produce type-safe model definitions.
 *
 * @template V - Generated value type produced by the model generator
 * @template EnrichmentType - Optional enrichment data type for additional metadata
 */
export type ModelInsertable<V, EnrichmentType = undefined> = { prototype: V } & {
  new ({
    context,
    refName,
    settings,
    destinationPath,
    rootRef
  }: ModelInsertableConstructorArgs<EnrichmentType>): V
  id: string
  type: 'model'
  toIdentifier: (refName: RefName) => Identifier
  toExportPath: (refName: RefName) => string
  toEnrichments: ({ refName, context }: ToModelEnrichmentsArgs) => EnrichmentType
  schemaToValueFn: SchemaToValueFn
  createIdentifier: (name: string) => Identifier
  // deno-lint-ignore ban-types
} & Function

/**
 * Configuration object for model generators.
 *
 * Defines the behavior and capabilities of model generators including
 * transformation logic, preview generation, and enrichment handling.
 *
 * @template EnrichmentType - Optional enrichment data type for additional metadata
 */
export type ModelConfig<EnrichmentType = undefined> = {
  id: string
  type: 'model'
  transform: <Acc = void>({ context, refName, acc }: TransformModelArgs<Acc>) => Acc
  toPreviewModule?: ({ context, refName }: ToModelPreviewModuleArgs) => PreviewModule
  toMappingModule?: ({ context, refName }: ToModelMappingArgs) => MappingModule
  toEnrichmentSchema?: () => v.BaseSchema<EnrichmentType, EnrichmentType, v.BaseIssue<unknown>>
  toEnrichmentRequest?: <RequestedEnrichment extends EnrichmentType>(
    refName: RefName
  ) => EnrichmentRequest<RequestedEnrichment> | undefined
}
