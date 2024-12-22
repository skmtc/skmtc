import type { GenerateContext, RegisterArgs } from '../context/GenerateContext.js'
import type { ContentSettings } from './ContentSettings.js'
import { ValueBase } from './ValueBase.js'

export type OperationGatewayArgs = {
  context: GenerateContext
  settings: ContentSettings
}

export class GatewayBase extends ValueBase {
  settings: ContentSettings

  constructor({ context, settings }: OperationGatewayArgs) {
    super({ context })

    this.settings = settings
  }

  override register(args: Omit<RegisterArgs, 'destinationPath'>) {
    this.context.register({
      ...args,
      destinationPath: this.settings.exportPath
    })
  }
}
