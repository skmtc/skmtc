import type { GenerateContext } from '../../context/GenerateContext.ts'
import type { ContentSettings } from '../ContentSettings.ts'
import type { RefName } from '../../types/RefName.ts'
import type { Identifier } from '../Identifier.ts'
import type { EnrichmentRequest } from '../../types/EnrichmentRequest.ts'
import type { z } from 'zod'
import type { SchemaItem } from '../../types/SchemaItem.ts'

type ModelInsertableConstructorArgs<EnrichmentType> = {
  context: GenerateContext
  refName: RefName
  settings: ContentSettings<EnrichmentType>
  destinationPath: string
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

export type ModelInsertable<V, EnrichmentType> = { prototype: V } & {
  new ({
    context,
    refName,
    settings,
    destinationPath
  }: ModelInsertableConstructorArgs<EnrichmentType>): V
  id: string
  type: 'model'

  toIdentifier: (refName: RefName) => Identifier
  toExportPath: (refName: RefName) => string
  toEnrichments: ({ refName, context }: ToEnrichmentsArgs) => EnrichmentType
  // deno-lint-ignore ban-types
} & Function

export type ModelConfig<EnrichmentType> = {
  id: string
  type: 'model'
  transform: <Acc = void>({ context, refName, acc }: TransformModelArgs<Acc>) => Acc
  toEnrichmentSchema: () => z.ZodType<EnrichmentType>
  toEnrichmentRequest?: <RequestedEnrichment extends EnrichmentType>(
    refName: RefName
  ) => EnrichmentRequest<RequestedEnrichment> | undefined

  toSchemaItem?: (refName: RefName) => SchemaItem
}
