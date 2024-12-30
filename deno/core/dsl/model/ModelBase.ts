import type { GenerateContext, RegisterArgs } from '../../context/GenerateContext.ts'
import type { GeneratedValue } from '../../types/GeneratedValue.ts'
import type { GeneratorKey } from '../../types/GeneratorKeys.ts'
import type { RefName } from '../../types/RefName.ts'
import type { ContentSettings } from '../ContentSettings.ts'
import type { ModelInsertable } from './ModelInsertable.ts'
import { ValueBase } from '../ValueBase.ts'
import type { Inserted } from '../Inserted.ts'

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

  insertModel<V extends GeneratedValue, EnrichmentType>(
    insertable: ModelInsertable<V, EnrichmentType>,
    refName: RefName
  ): Inserted<V, 'force', EnrichmentType> {
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
