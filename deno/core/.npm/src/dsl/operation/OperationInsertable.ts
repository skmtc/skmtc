import type { OasOperation } from '../../oas/operation/Operation.js'
import type { ContentSettings } from '../ContentSettings.js'
import type { GenerateContext } from '../../context/GenerateContext.js'
import type { Identifier } from '../Identifier.js'

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

  isSupported: (operation: OasOperation) => boolean

  pinnable: boolean

  // deno-lint-ignore ban-types
} & Function
