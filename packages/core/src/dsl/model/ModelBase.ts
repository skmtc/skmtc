import type { GenerateContext, RegisterArgs } from '../../context/GenerateContext.js'
import type { GeneratedValue } from '../../types/GeneratedValue.js'
import type { GeneratorKey } from '../../types/GeneratorKeys.js'
import type { RefName } from '../../types/RefName.js'
import type { ContentSettings } from '../ContentSettings.js'
import type { ModelInsertable } from './ModelInsertable.js'
import { ValueBase } from '../ValueBase.js'
import type { Inserted } from '../Inserted.js'

export type ModelBaseArgs<EnrichmentType> = {
  context: GenerateContext
  settings: ContentSettings<EnrichmentType>
  generatorKey: GeneratorKey
  refName: RefName
}

export class ModelBase<EnrichmentType> extends ValueBase {
  settings: ContentSettings<EnrichmentType>
  refName: RefName

  override generatorKey: GeneratorKey
  constructor({ context, settings, generatorKey, refName }: ModelBaseArgs<EnrichmentType>) {
    super({ context })

    this.generatorKey = generatorKey
    this.refName = refName
    this.settings = settings
  }

  insertModel<V extends GeneratedValue, ET>(
    insertable: ModelInsertable<V, ET>,
    refName: RefName
  ): Inserted<V, 'force', ET> {
    return this.context.insertModel({
      insertable,
      refName,
      generation: 'force',
      destinationPath: this.settings.exportPath
    })
  }

  override register(args: Omit<RegisterArgs, 'destinationPath'>): void {
    this.context.register({
      ...args,
      destinationPath: this.settings.exportPath
    })
  }
}
