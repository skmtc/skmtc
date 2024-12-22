import type { OasOperation } from '../../oas/operation/Operation.js'
import { GatewayBase, type OperationGatewayArgs } from '../GatewayBase.js'
import type { Identifier } from '../Identifier.js'

export type ToOperationGatewayArgs = {
  id: string
  toIdentifier: () => Identifier
  toExportPath: () => string
  isSupported?: (operation: OasOperation) => boolean
}

export const toOperationGateway = (config: ToOperationGatewayArgs) => {
  const OperationGateway = class extends GatewayBase {
    static id = config.id
    static type = 'operation' as const
    static _class = 'OperationGateway' as const

    static toIdentifier = config.toIdentifier.bind(config)
    static toExportPath = config.toExportPath.bind(config)

    static isSupported = config.isSupported ?? (() => true)

    static pinnable = false

    constructor({ context, settings }: OperationGatewayArgs) {
      super({ context, settings })
    }
  }

  return OperationGateway
}
