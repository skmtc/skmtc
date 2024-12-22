import type { OperationInsertable } from './OperationInsertable.ts'
import type { OasOperation } from '../../oas/operation/Operation.ts'
import type { ContentSettings } from '../ContentSettings.ts'
import type { GenerateContext, RegisterArgs } from '../../context/GenerateContext.ts'
import type { GeneratedValue } from '../../types/GeneratedValue.ts'
import type { GeneratorKey } from '../../types/GeneratorKeys.ts'
import { ValueBase } from '../ValueBase.ts'
import type { Definition } from '../Definition.ts'
import type { Identifier } from '../Identifier.ts'
import type { SchemaToValueFn, SchemaType, TypeSystemOutput } from '../../types/TypeSystem.ts'
import type { Inserted } from '../Inserted.ts'
import type { ModelInsertable } from '../model/ModelInsertable.ts'
import type { RefName } from '../../types/RefName.ts'

export type OperationBaseArgs = {
  context: GenerateContext
  settings: ContentSettings
  generatorKey: GeneratorKey
  operation: OasOperation
}

type CreateAndRegisterDefinition<Schema extends SchemaType> = {
  schema: Schema
  identifier: Identifier
  schemaToValueFn: SchemaToValueFn
}

export class OperationBase extends ValueBase {
  settings: ContentSettings
  operation: OasOperation
  override generatorKey: GeneratorKey

  constructor({ context, generatorKey, settings, operation }: OperationBaseArgs) {
    super({ context })

    this.generatorKey = generatorKey
    this.operation = operation
    this.settings = settings
  }

  insertOperation<V extends GeneratedValue>(
    insertable: OperationInsertable<V>,
    operation: OasOperation
  ): Inserted<V, 'force'> {
    return this.context.insertOperation({
      insertable,
      operation,
      generation: 'force',
      destinationPath: this.settings.exportPath
    })
  }

  insertModel<V extends GeneratedValue>(
    insertable: ModelInsertable<V>,
    refName: RefName
  ): Inserted<V, 'force'> {
    return this.context.insertModel({
      insertable,
      refName,
      generation: 'force',
      destinationPath: this.settings.exportPath
    })
  }

  createAndRegisterDefinition<Schema extends SchemaType>({
    schema,
    identifier,
    schemaToValueFn
  }: CreateAndRegisterDefinition<Schema>): Definition<TypeSystemOutput<Schema['type']>> {
    return this.context.createAndRegisterDefinition({
      schema,
      identifier,
      schemaToValueFn,
      destinationPath: this.settings.exportPath
    })
  }

  override register(args: Omit<RegisterArgs, 'destinationPath'>) {
    this.context.register({
      ...args,
      destinationPath: this.settings.exportPath
    })
  }
}
