import type { OperationInsertable } from './types.ts'
import type { OasOperation } from '../../oas/operation/Operation.ts'
import type { ContentSettings } from '../ContentSettings.ts'
import type { BaseRegisterArgs, GenerateContext } from '../../context/GenerateContext.ts'
import type { GeneratedValue } from '../../types/GeneratedValue.ts'
import { toGeneratorId, type GeneratorKey } from '../../types/GeneratorKeys.ts'
import { ValueBase } from '../ValueBase.ts'
import type { Definition } from '../Definition.ts'
import type { Identifier } from '../Identifier.ts'
import type { SchemaToValueFn, SchemaType, TypeSystemOutput } from '../../types/TypeSystem.ts'
import type { Inserted } from '../Inserted.ts'
import type { ModelInsertable } from '../model/types.ts'
import type { RefName } from '../../types/RefName.ts'

export type OperationBaseArgs<EnrichmentType = undefined> = {
  context: GenerateContext
  settings: ContentSettings<EnrichmentType>
  generatorKey: GeneratorKey
  operation: OasOperation
}

type CreateAndRegisterDefinition<Schema extends SchemaType> = {
  schema: Schema
  identifier: Identifier
  schemaToValueFn: SchemaToValueFn
  rootRef: RefName
}

export class OperationBase<EnrichmentType = undefined> extends ValueBase {
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
    operation: OasOperation
  ): Inserted<V, 'force', EnrichmentType> {
    return this.context.insertOperation({
      insertable,
      operation,
      generation: 'force',
      destinationPath: this.settings.exportPath
    })
  }

  insertModel<V extends GeneratedValue, EnrichmentType = undefined>(
    insertable: ModelInsertable<V, EnrichmentType>,
    refName: RefName
  ): Inserted<V, 'force', EnrichmentType> {
    return this.context.insertModel({
      insertable,
      refName,
      generation: 'force',
      destinationPath: this.settings.exportPath,
      rootRef: refName
    })
  }

  createAndRegisterDefinition<Schema extends SchemaType>({
    schema,
    identifier,
    schemaToValueFn,
    rootRef
  }: CreateAndRegisterDefinition<Schema>): Definition<TypeSystemOutput<Schema['type']>> {
    return this.context.createAndRegisterDefinition({
      schema,
      identifier,
      schemaToValueFn,
      destinationPath: this.settings.exportPath,
      rootRef: rootRef
    })
  }

  override register(args: BaseRegisterArgs) {
    const preview = Object.keys(args.preview ?? {}).length
      ? Object.fromEntries(
          Object.entries(args.preview ?? {}).map(([group, preview]) => {
            const previewWithSource = {
              ...preview,
              source: {
                type: 'operation' as const,
                generatorId: toGeneratorId(this.generatorKey),
                operationPath: this.operation.path,
                operationMethod: this.operation.method
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
