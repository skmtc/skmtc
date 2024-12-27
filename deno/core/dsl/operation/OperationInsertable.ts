import type { OasOperation } from '../../oas/operation/Operation.ts'
import type { ContentSettings } from '../ContentSettings.ts'
import type { GenerateContext } from '../../context/GenerateContext.ts'
import type { Identifier } from '../Identifier.ts'
import type { EnrichmentRequest } from '../../types/EnrichmentRequest.ts'

type OperationInsertableConstructorArgs = {
  context: GenerateContext
  settings: ContentSettings
  operation: OasOperation
}

export type WithTransformOperation = {
  transformOperation: (operation: OasOperation) => void
}

export type OperationOperationGatewayArgs = {
  context: GenerateContext
  settings: ContentSettings
}

export type OperationGateway = {
  new ({ context, settings }: OperationOperationGatewayArgs): WithTransformOperation
  id: string
  type: 'operation'
  _class: 'OperationGateway'

  toIdentifier: () => Identifier
  toExportPath: () => string
  toEnrichmentRequest?: (operation: OasOperation) => EnrichmentRequest
  isSupported: (operation: OasOperation) => boolean

  pinnable: boolean
}

export type OperationInsertable<V> = { prototype: V } & {
  new ({ context, settings, operation }: OperationInsertableConstructorArgs): V
  id: string
  type: 'operation'
  _class: 'OperationInsertable'
  toIdentifier: (operation: OasOperation) => Identifier
  toExportPath: (operation: OasOperation) => string
  toEnrichmentRequest?: (operation: OasOperation) => EnrichmentRequest
  isSupported: (operation: OasOperation) => boolean

  pinnable: boolean

  // deno-lint-ignore ban-types
} & Function
