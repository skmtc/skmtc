import type { GenerateContext } from '../../context/GenerateContext.ts'
import type { ContentSettings } from '../ContentSettings.ts'
import type { RefName } from '../../types/RefName.ts'
import type { Identifier } from '../Identifier.ts'
import type { EnrichmentRequest } from '../../types/EnrichmentRequest.ts'
import type * as v from 'valibot'
import type { PreviewModule } from '../../types/Preview.ts'

type ModelInsertableConstructorArgs<EnrichmentType = undefined> = {
  context: GenerateContext
  refName: RefName
  settings: ContentSettings<EnrichmentType>
  destinationPath: string
  rootRef?: RefName
}

export type WithTransformModel = {
  transformModel: (refName: RefName) => void
}

type ToEnrichmentsArgs = {
  refName: RefName
  context: GenerateContext
}

export type TransformModelArgs<Acc> = {
  context: GenerateContext
  refName: RefName
  acc: Acc | undefined
}

export type ToModelPreviewModuleArgs = {
  context: GenerateContext
  refName: RefName
}

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
  toEnrichments: ({ refName, context }: ToEnrichmentsArgs) => EnrichmentType
  // deno-lint-ignore ban-types
} & Function

export type ModelConfig<EnrichmentType = undefined> = {
  id: string
  type: 'model'
  transform: <Acc = void>({ context, refName, acc }: TransformModelArgs<Acc>) => Acc
  toPreviewModule?: ({ context, refName }: ToModelPreviewModuleArgs) => PreviewModule
  toEnrichmentSchema?: () => v.BaseSchema<EnrichmentType, EnrichmentType, v.BaseIssue<unknown>>
  toEnrichmentRequest?: <RequestedEnrichment extends EnrichmentType>(
    refName: RefName
  ) => EnrichmentRequest<RequestedEnrichment> | undefined
}
