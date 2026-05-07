import type { GenerateContextType } from '../../context/generateTypes.ts'
import type { ContentSettings } from '@/dsl/ContentSettings.ts'
import type { RefName } from '@/types/RefName.ts'
import type { Identifier } from '@/dsl/Identifier.ts'
import type { EnrichmentRequest } from '@/types/EnrichmentRequest.ts'
import type * as v from 'valibot'
import type { MappingModule, PreviewModule } from '@/types/Preview.ts'
import type { SchemaToValueFn } from '@/types/TypeSystem.ts'

/**
 * External constructor signature for a model projection class.
 *
 * The pipeline calls `new SomeProjection(args)` with this shape; the
 * runtime base class ({@link ModelProjectionBase}) injects `generatorKey`
 * before calling `super()`.
 */
export type ModelProjectionConstructorArgs<EnrichmentType = undefined> = {
  context: GenerateContextType
  refName: RefName
  settings: ContentSettings<EnrichmentType>
  destinationPath: string
  rootRef?: RefName
}

export type WithTransformModel = {
  transformModel: (refName: RefName) => void
}

export type ToModelEnrichmentsArgs = {
  refName: RefName
  context: GenerateContextType
}

export type TransformModelArgs<Acc> = {
  context: GenerateContextType
  refName: RefName
  acc: Acc | undefined
}

export type ToModelPreviewModuleArgs = {
  context: GenerateContextType
  refName: RefName
}

export type ToModelMappingArgs = {
  context: GenerateContextType
  refName: RefName
}

/**
 * Static structural type of a model projection class.
 *
 * Captures both the instance side (`new(...) => V`) and the static side
 * (`id`, `toIdentifier`, `toExportPath`, `toEnrichments`,
 * `schemaToValueFn`, `createIdentifier`). Passed as a type parameter to
 * `context.insertModel(...)`.
 */
export type ModelProjection<V, EnrichmentType = undefined> = { prototype: V } & {
  new ({
    context,
    refName,
    settings,
    destinationPath,
    rootRef
  }: ModelProjectionConstructorArgs<EnrichmentType>): V
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
 * Pipeline-side configuration for a model projection (built by
 * `toModelEntry`). Carries the iteration callback (`transform`) and
 * optional preview/mapping/enrichment hooks.
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
