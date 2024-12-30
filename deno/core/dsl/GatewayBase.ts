import type { GenerateContext, RegisterArgs } from '../context/GenerateContext.ts'
import type { ContentSettings } from './ContentSettings.ts'
import { ValueBase } from './ValueBase.ts'

export type OperationGatewayArgs = {
  context: GenerateContext
  settings: ContentSettings<undefined>
}

export class GatewayBase extends ValueBase {
  settings: ContentSettings<undefined>

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
