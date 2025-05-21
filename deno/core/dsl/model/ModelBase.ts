import type { BaseRegisterArgs, GenerateContext } from '../../context/GenerateContext.ts'
import type { GeneratedValue } from '../../types/GeneratedValue.ts'
import type { GeneratorKey } from '../../types/GeneratorKeys.ts'
import type { RefName } from '../../types/RefName.ts'
import type { ContentSettings } from '../ContentSettings.ts'
import type { ModelInsertable } from './types.ts'
import { ContentBase } from '../ContentBase.ts'
import type { Inserted } from '../Inserted.ts'
import { toGeneratorId } from '../../types/GeneratorKeys.ts'
export type ModelBaseArgs<EnrichmentType = undefined> = {
  context: GenerateContext
  settings: ContentSettings<EnrichmentType>
  generatorKey: GeneratorKey
  refName: RefName
}

export class ModelBase<EnrichmentType = undefined> extends ContentBase {
  settings: ContentSettings<EnrichmentType>
  refName: RefName

  override generatorKey: GeneratorKey
  constructor({ context, settings, generatorKey, refName }: ModelBaseArgs<EnrichmentType>) {
    super({ context })

    this.generatorKey = generatorKey
    this.refName = refName
    this.settings = settings
  }

  insertModel<V extends GeneratedValue, EnrichmentType = undefined>(
    insertable: ModelInsertable<V, EnrichmentType>,
    refName: RefName
  ): Inserted<V, 'force', EnrichmentType> {
    return this.context.insertModel(insertable, refName, {
      generation: 'force',
      destinationPath: this.settings.exportPath
    })
  }

  override register(args: BaseRegisterArgs): void {
    const preview = Object.keys(args.preview ?? {}).length
      ? Object.fromEntries(
          Object.entries(args.preview ?? {}).map(([group, preview]) => {
            const previewWithSource = {
              ...preview,
              source: {
                type: 'model' as const,
                generatorId: toGeneratorId(this.generatorKey),
                refName: this.refName
              }
            }

            return [group, previewWithSource]
          })
        )
      : undefined

    this.context.register({
      ...args,
      preview,
      destinationPath: this.settings.exportPath
    })
  }
}
