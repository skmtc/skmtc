import type { GqlOperationInsertable } from './types.ts'
import type { GqlOperation } from '@/gql/operation/GqlOperation.ts'
import type { OasOperation } from '@/oas/operation/Operation.ts'
import type { ContentSettings } from '@/dsl/ContentSettings.ts'
import type {
  DefineAndRegisterArgs,
  InsertOperationOptions,
  InsertModelOptions,
  InsertNormalisedModelArgs,
  InsertNormalisedModelReturn,
  BaseRegisterArgs,
  GenerateContextType
} from '../../../context/generateTypes.ts'
import type { GeneratedValue } from '@/dsl/GeneratedValue.ts'
import type { GeneratorKey } from '@/dsl/GeneratorKeys.ts'
import { ContentBase } from '@/dsl/ContentBase.ts'
import type { Definition } from '@/dsl/Definition.ts'
import type { Inserted } from '@/dsl/Inserted.ts'
import type { ModelInsertable } from '@/dsl/model/types.ts'
import type { RefName } from '@/types/RefName.ts'
import type { OasSchema } from '@/oas/schema/Schema.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import type { OasVoid } from '@/oas/void/Void.ts'

/**
 * Constructor arguments for {@link GqlOperationBase}.
 *
 * @template EnrichmentType - Optional type for custom enrichment data
 */
export type GqlOperationBaseArgs<EnrichmentType = undefined> = {
  /** The generation context providing access to the processing pipeline */
  context: GenerateContextType
  /** Content settings including export path and enrichment configuration */
  settings: ContentSettings<EnrichmentType>
  /** Unique identifier for this generator type */
  generatorKey: GeneratorKey
  /** The GraphQL operation being processed */
  operation: GqlOperation
}

/**
 * Base class for GraphQL operation generators in the SKMTC DSL system.
 *
 * `GqlOperationBase` extends {@link ContentBase} to provide specialized functionality for
 * generating code from GraphQL root-field operations. It offers type-safe methods for
 * inserting related operations and models, managing operation dependencies, and handling
 * enrichments specific to GraphQL operations.
 *
 * This class serves as the foundation for creating custom operation generators that
 * transform GraphQL operations into various code artifacts like typed document nodes,
 * client hooks, resolvers, or test fixtures.
 *
 * ## Key Features
 *
 * - **Operation Insertion**: Insert related operations with automatic dependency tracking
 * - **Model Integration**: Seamlessly insert related models from operation argument and
 *   return type schemas
 * - **Schema Normalization**: Handle complex argument and return-type references
 * - **Export Management**: Control which operations are exported from generated files
 * - **Enrichment Support**: Extend functionality with operation-specific enrichment data
 * - **Type Safety**: Full TypeScript support with generic enrichment types
 *
 * @template EnrichmentType - Optional type for custom enrichment data
 *
 * @example Basic typed-document-node generator
 * ```typescript
 * import { GqlOperationBase, Definition } from '@skmtc/core';
 *
 * class TypedDocumentNode extends GqlOperationBase {
 *   toDefinition(): Definition {
 *     const { rootKind, fieldName } = this.operation;
 *
 *     return new Definition({
 *       name: `${fieldName}Document`,
 *       content: `export const ${fieldName}Document: TypedDocumentNode<...> = gql\`${rootKind} { ... }\``
 *     });
 *   }
 * }
 * ```
 */
export class GqlOperationBase<EnrichmentType = undefined> extends ContentBase {
  /** Content settings including export path and enrichment configuration */
  settings: ContentSettings<EnrichmentType>

  /** The GraphQL operation being processed */
  operation: GqlOperation

  /** Generator key identifying this generator type */
  override generatorKey: GeneratorKey

  /**
   * Creates a new GqlOperationBase instance.
   *
   * @param args - Operation generator configuration
   * @param args.context - The generation context providing pipeline access
   * @param args.settings - Content settings with export path and enrichments
   * @param args.generatorKey - Unique identifier for this generator type
   * @param args.operation - The GraphQL operation being processed
   */
  constructor({
    context,
    generatorKey,
    settings,
    operation
  }: GqlOperationBaseArgs<EnrichmentType>) {
    super({ context })

    this.generatorKey = generatorKey
    this.operation = operation
    this.settings = settings
  }

  /**
   * Inserts a related GraphQL operation with forced generation.
   *
   * Adds a related operation to the current generation context, ensuring it will be
   * generated regardless of whether it already exists. Useful for operations that depend
   * on or generate helper operations.
   */
  insertOperation<V extends GeneratedValue, EnrichmentType = undefined>(
    insertable: GqlOperationInsertable<V, EnrichmentType>,
    operation: GqlOperation,
    options: Pick<InsertOperationOptions, 'noExport'> = {}
  ): Inserted<V, EnrichmentType> {
    // GenerateContextType is currently OAS-typed; the dispatcher narrows on
    // the active document at runtime. Cast bridges the static gap until
    // GenerateContext gains a protocol-discriminated overload.
    return this.context.insertOperation({
      insertable: insertable,
      operation: operation,
      destinationPath: this.settings.exportPath,
      noExport: options.noExport
    })
  }

  /**
   * Inserts a related model with forced generation.
   *
   * Typically used for argument-object or return-type models that the operation
   * references. The model will be generated and can be referenced in the operation
   * code.
   */
  insertModel<V extends GeneratedValue, EnrichmentType = undefined>(
    insertable: ModelInsertable<V, EnrichmentType>,
    refName: RefName,
    options: Pick<InsertModelOptions, 'noExport'> = {}
  ): Inserted<V, EnrichmentType> {
    return this.context.insertModel(insertable, refName, {
      destinationPath: this.settings.exportPath,
      noExport: options.noExport
    })
  }

  /**
   * Inserts a related model with automatic schema normalization and reference
   * resolution. Particularly useful when the operation's argument or return-type
   * schema is a `OasRef`.
   */
  insertNormalizedModel<
    V extends GeneratedValue,
    Schema extends OasSchema | OasRef<'schema'> | OasVoid,
    EnrichmentType = undefined
  >(
    insertable: ModelInsertable<V, EnrichmentType>,
    { schema, fallbackName }: Omit<InsertNormalisedModelArgs<Schema>, 'destinationPath'>,
    options: Pick<InsertModelOptions, 'noExport'> = {}
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

  /**
   * Defines and registers a new definition in the generation context.
   *
   * @experimental This method's API may change in future versions.
   */
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

  /**
   * Registers a file-level artifact with the generation context. The registration
   * is automatically scoped to this operation's export path.
   */
  override register(args: BaseRegisterArgs): void {
    this.context.register({
      ...args,
      destinationPath: this.settings.exportPath
    })
  }
}
