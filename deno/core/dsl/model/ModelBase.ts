import type {
  BaseRegisterArgs,
  GenerateContext,
  InsertModelOptions,
  InsertNormalisedModelArgs
} from '../../context/GenerateContext.ts'
import type { GeneratedValue } from '../../types/GeneratedValue.ts'
import type { GeneratorKey } from '../../types/GeneratorKeys.ts'
import type { RefName } from '../../types/RefName.ts'
import type { ContentSettings } from '../ContentSettings.ts'
import type { ModelInsertable } from './types.ts'
import { ContentBase } from '../ContentBase.ts'
import type { Inserted } from '../Inserted.ts'
import type { OasSchema } from '../../oas/schema/Schema.ts'
import type { OasRef } from '../../oas/ref/Ref.ts'
import type { SchemaToRef, TypeSystemOutput } from '../../types/TypeSystem.ts'
import type { Definition } from '../Definition.ts'

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
    refName: RefName,
    options: Pick<InsertModelOptions<'force'>, 'noExport'> = {}
  ): Inserted<V, 'force', EnrichmentType> {
    return this.context.insertModel(insertable, refName, {
      generation: 'force',
      destinationPath: this.settings.exportPath,
      noExport: options.noExport
    })
  }

  insertNormalizedModel<Schema extends OasSchema | OasRef<'schema'>, EnrichmentType = undefined>(
    insertable: ModelInsertable<TypeSystemOutput<SchemaToRef<Schema>['type']>, EnrichmentType>,
    { schema, fallbackIdentifier }: Omit<InsertNormalisedModelArgs<Schema>, 'destinationPath'>,
    options: Pick<InsertModelOptions<'force'>, 'noExport'> = {}
  ): Definition<TypeSystemOutput<Schema['type']>> {
    return this.context.insertNormalisedModel(
      insertable,
      {
        schema,
        fallbackIdentifier,
        destinationPath: this.settings.exportPath
      },
      options
    )
  }

  override register(args: BaseRegisterArgs): void {
    this.context.register({
      ...args,
      destinationPath: this.settings.exportPath
    })
  }
}
