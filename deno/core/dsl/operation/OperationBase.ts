import type { OperationInsertable } from './types.ts'
import type { OasOperation } from '../../oas/operation/Operation.ts'
import type { ContentSettings } from '../ContentSettings.ts'
import type {
  BaseRegisterArgs,
  GenerateContext,
  CreateAndRegisterDefinition,
  DefineAndRegisterArgs,
  InsertOperationOptions,
  InsertModelOptions
} from '../../context/GenerateContext.ts'
import type { GeneratedValue } from '../../types/GeneratedValue.ts'
import type { GeneratorKey } from '../../types/GeneratorKeys.ts'
import { ContentBase } from '../ContentBase.ts'
import type { Definition } from '../Definition.ts'
import type { SchemaToValueFn, SchemaType, TypeSystemOutput } from '../../types/TypeSystem.ts'
import type { Inserted } from '../Inserted.ts'
import type { ModelInsertable } from '../model/types.ts'
import type { RefName } from '../../types/RefName.ts'
import type { Identifier } from '../Identifier.ts'

export type OperationBaseArgs<EnrichmentType = undefined> = {
  context: GenerateContext
  settings: ContentSettings<EnrichmentType>
  generatorKey: GeneratorKey
  operation: OasOperation
}

type CreateAndRegisterCannonicalArgs<Schema extends SchemaType> = {
  schema: Schema
  fallbackIdentifier: Identifier
  schemaToValueFn: SchemaToValueFn
  noExport?: boolean
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

  /** @experimental */
  createAndRegisterCannonical<Schema extends SchemaType>({
    schema,
    fallbackIdentifier,
    schemaToValueFn,
    noExport
  }: CreateAndRegisterCannonicalArgs<Schema>): TypeSystemOutput<Schema['type']> {
    const value = schemaToValueFn({
      context: this.context,
      schema,
      destinationPath: this.settings.exportPath,
      required: true,
      rootRef: schema.isRef() ? schema.toRefName() : undefined
    })

    return schema.isRef()
      ? value
      : this.defineAndRegister({ identifier: fallbackIdentifier, value, noExport }).value
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

  /** @experimental */
  createAndRegisterDefinition<Schema extends SchemaType>({
    schema,
    identifier,
    schemaToValueFn,
    rootRef,
    noExport
  }: Omit<CreateAndRegisterDefinition<Schema>, 'destinationPath'>): Definition<
    TypeSystemOutput<Schema['type']>
  > {
    return this.context.createAndRegisterDefinition({
      schema,
      identifier,
      schemaToValueFn,
      destinationPath: this.settings.exportPath,
      rootRef: rootRef,
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
