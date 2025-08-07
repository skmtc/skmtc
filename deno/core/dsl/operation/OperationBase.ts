import type { OperationInsertable } from './types.ts'
import type { OasOperation } from '../../oas/operation/Operation.ts'
import type { ContentSettings } from '../ContentSettings.ts'
import type {
  BaseRegisterArgs,
  GenerateContext,
  CreateAndRegisterDefinition,
  DefineAndRegisterArgs,
  InsertOperationOptions,
  InsertModelOptions,
  InsertNormalisedModelArgs,
  InsertNormalisedModelReturn
} from '../../context/GenerateContext.ts'
import type { GeneratedValue } from '../../types/GeneratedValue.ts'
import type { GeneratorKey } from '../../types/GeneratorKeys.ts'
import { ContentBase } from '../ContentBase.ts'
import type { Definition } from '../Definition.ts'
import type { SchemaType, TypeSystemOutput } from '../../types/TypeSystem.ts'
import type { Inserted } from '../Inserted.ts'
import type { ModelInsertable } from '../model/types.ts'
import type { RefName } from '../../types/RefName.ts'
import { OasSchema } from '../../oas/schema/Schema.ts'
import { OasRef } from '../../oas/ref/Ref.ts'
import { OasVoid } from '../../oas/void/Void.ts'

export type OperationBaseArgs<EnrichmentType = undefined> = {
  context: GenerateContext
  settings: ContentSettings<EnrichmentType>
  generatorKey: GeneratorKey
  operation: OasOperation
}

export class OperationBase<EnrichmentType = undefined> extends ContentBase {
  settings: ContentSettings<EnrichmentType>
  operation: OasOperation
  override generatorKey: GeneratorKey

  constructor({ context, generatorKey, settings, operation }: OperationBaseArgs<EnrichmentType>) {
    super({ context })

    this.generatorKey = generatorKey
    this.operation = operation
    this.settings = settings
  }

  insertOperation<V extends GeneratedValue, EnrichmentType = undefined>(
    insertable: OperationInsertable<V, EnrichmentType>,
    operation: OasOperation,
    options: Pick<InsertOperationOptions<'force'>, 'noExport'> = {}
  ): Inserted<V, 'force', EnrichmentType> {
    return this.context.insertOperation(insertable, operation, {
      generation: 'force',
      destinationPath: this.settings.exportPath,
      noExport: options.noExport
    })
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

  insertNormalizedModel<
    V extends GeneratedValue,
    Schema extends OasSchema | OasRef<'schema'> | OasVoid,
    EnrichmentType = undefined
  >(
    insertable: ModelInsertable<V, EnrichmentType>,
    { schema, fallbackName }: Omit<InsertNormalisedModelArgs<Schema>, 'destinationPath'>,
    options: Pick<InsertModelOptions<'force'>, 'noExport'> = {}
  ): InsertNormalisedModelReturn<V, Schema> {
    return this.context.insertNormalisedModel(
      insertable,
      {
        schema,
        fallbackName,
        destinationPath: this.settings.exportPath
      },
      options
    )
  }

  /** @experimental */
  defineAndRegister<V extends GeneratedValue>({
    identifier,
    value,
    noExport
  }: Omit<DefineAndRegisterArgs<V>, 'destinationPath'>): Definition<V> {
    return this.context.defineAndRegister({
      identifier,
      value,
      destinationPath: this.settings.exportPath,
      noExport
    })
  }

  override register(args: BaseRegisterArgs) {
    this.context.register({
      ...args,
      destinationPath: this.settings.exportPath
    })
  }
}
