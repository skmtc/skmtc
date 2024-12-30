import type { GenerateContext, RegisterArgs } from '../context/GenerateContext.ts'
import type { ContentSettings } from './ContentSettings.ts'
import { ValueBase } from './ValueBase.ts'

export type OperationGatewayArgs<EnrichmentType> = {
  context: GenerateContext
  settings: ContentSettings<EnrichmentType>
}

export class GatewayBase<EnrichmentType> extends ValueBase {
  settings: ContentSettings<EnrichmentType>

  constructor({ context, settings }: OperationGatewayArgs<EnrichmentType>) {
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
