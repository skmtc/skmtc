import type { GenerateContext } from '../../context/GenerateContext.js'
import type { ContentSettings } from '../ContentSettings.js'
import type { RefName } from '../../types/RefName.js'
import type { Identifier } from '../Identifier.js'
import type { EnrichmentRequest } from '../../types/EnrichmentRequest.js'

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

export type ModelInsertable<V, EnrichmentType> = { prototype: V } & {
  new ({
    context,
    refName,
    settings,
    destinationPath
  }: ModelInsertableConstructorArgs<EnrichmentType>): V
  id: string
  type: 'model'
  _class: 'ModelInsertable'

  toIdentifier: (refName: RefName) => Identifier
  toExportPath: (refName: RefName) => string
  toEnrichmentRequest?: <RequestedEnrichment extends EnrichmentType>(
    refName: RefName
  ) => EnrichmentRequest<RequestedEnrichment> | undefined
  toEnrichments: ({ refName, context }: ToEnrichmentsArgs) => EnrichmentType
  isSupported: () => boolean

  pinnable: boolean

  // deno-lint-ignore ban-types
} & Function
