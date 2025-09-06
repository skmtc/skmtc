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

/**
 * Constructor arguments for {@link OperationBase}.
 * 
 * @template EnrichmentType - Optional type for custom enrichment data
 */
export type OperationBaseArgs<EnrichmentType = undefined> = {
  /** The generation context providing access to the processing pipeline */
  context: GenerateContext
  /** Content settings including export path and enrichment configuration */
  settings: ContentSettings<EnrichmentType>
  /** Unique identifier for this generator type */
  generatorKey: GeneratorKey
  /** The OpenAPI operation being processed */
  operation: OasOperation
}

/**
 * Base class for operation generators in the SKMTC DSL system.
 * 
 * `OperationBase` extends {@link ContentBase} to provide specialized functionality for
 * generating code from OpenAPI operations. It offers type-safe methods for inserting
 * related operations and models, managing complex operation dependencies, and handling
 * enrichments specific to API operations.
 * 
 * This class serves as the foundation for creating custom operation generators that
 * transform OpenAPI operations into various code artifacts like API clients, server
 * handlers, validation middleware, or documentation.
 * 
 * ## Key Features
 * 
 * - **Operation Insertion**: Insert related operations with automatic dependency tracking
 * - **Model Integration**: Seamlessly insert related models from operation schemas
 * - **Schema Normalization**: Handle complex request/response schema references
 * - **Export Management**: Control which operations are exported from generated files
 * - **Enrichment Support**: Extend functionality with operation-specific enrichment data
 * - **Type Safety**: Full TypeScript support with generic enrichment types
 * 
 * @template EnrichmentType - Optional type for custom enrichment data
 * 
 * @example Basic API client generator
 * ```typescript
 * import { OperationBase, Definition } from '@skmtc/core';
 * 
 * class ApiClientMethod extends OperationBase {
 *   toDefinition(): Definition {
 *     const { method, path, operationId } = this.operation;
 *     
 *     return new Definition({
 *       name: operationId || `${method}${this.pascalCasePath()}`,
 *       content: `async ${operationId}(${this.generateParameters()}) {
 *         return this.request('${method}', '${path}', ${this.generateRequestBody()});
 *       }`
 *     });
 *   }
 * }
 * ```
 * 
 * @example With request/response models
 * ```typescript
 * class TypedApiMethod extends OperationBase {
 *   toDefinition(): Definition {
 *     const operation = this.operation;
 *     
 *     // Generate request model if needed
 *     let requestType = 'void';
 *     if (operation.requestBody?.content?.['application/json']?.schema) {
 *       const requestModel = this.insertNormalizedModel(
 *         new RequestModel({ ... }),
 *         {
 *           schema: operation.requestBody.content['application/json'].schema,
 *           fallbackName: `${operation.operationId}Request`
 *         }
 *       );
 *       requestType = requestModel.value;
 *     }
 *     
 *     // Generate response model
 *     const responseSchema = operation.responses?.['200']?.content?.['application/json']?.schema;
 *     const responseModel = this.insertNormalizedModel(
 *       new ResponseModel({ ... }),
 *       { schema: responseSchema, fallbackName: `${operation.operationId}Response` }
 *     );
 *     
 *     return new Definition({
 *       name: operation.operationId,
 *       content: `async ${operation.operationId}(data: ${requestType}): Promise<${responseModel.value}> {
 *         return this.request('${operation.method}', '${operation.path}', data);
 *       }`
 *     });
 *   }
 * }
 * ```
 * 
 * @example With enrichments
 * ```typescript
 * type AuthEnrichment = {
 *   requiresAuth: boolean;
 *   permissions: string[];
 * };
 * 
 * class SecuredApiMethod extends OperationBase<AuthEnrichment> {
 *   toDefinition(): Definition {
 *     const enrichment = this.settings.enrichment;
 *     const requiresAuth = enrichment?.requiresAuth ?? false;
 *     
 *     const authCheck = requiresAuth 
 *       ? 'this.checkAuth();' 
 *       : '';
 *     
 *     return new Definition({
 *       name: this.operation.operationId,
 *       content: `async ${this.operation.operationId}() {
 *         ${authCheck}
 *         return this.request('${this.operation.method}', '${this.operation.path}');
 *       }`
 *     });
 *   }
 * }
 * ```
 */
export class OperationBase<EnrichmentType = undefined> extends ContentBase {
  /** Content settings including export path and enrichment configuration */
  settings: ContentSettings<EnrichmentType>
  
  /** The OpenAPI operation being processed */
  operation: OasOperation
  
  /** Generator key identifying this generator type */
  override generatorKey: GeneratorKey

  /**
   * Creates a new OperationBase instance.
   * 
   * @param args - Operation generator configuration
   * @param args.context - The generation context providing pipeline access
   * @param args.settings - Content settings with export path and enrichments
   * @param args.generatorKey - Unique identifier for this generator type
   * @param args.operation - The OpenAPI operation being processed
   * 
   * @example
   * ```typescript
   * const operation = new OperationBase({
   *   context: generateContext,
   *   settings: {
   *     exportPath: './src/api.ts',
   *     enrichment: customEnrichments
   *   },
   *   generatorKey: 'api-client',
   *   operation: oasOperation
   * });
   * ```
   */
  constructor({ context, generatorKey, settings, operation }: OperationBaseArgs<EnrichmentType>) {
    super({ context })

    this.generatorKey = generatorKey
    this.operation = operation
    this.settings = settings
  }

  /**
   * Inserts a related operation with forced generation.
   * 
   * This method adds a related operation to the current generation context, ensuring
   * it will be generated regardless of whether it already exists. This is useful for
   * operations that depend on other operations or need to generate helper operations.
   * 
   * @template V - Type of generated value returned by the insertable
   * @template EnrichmentType - Type of enrichment data for the insertable
   * @param insertable - The operation generator to insert
   * @param operation - The OpenAPI operation to process
   * @param options - Insertion options
   * @param options.noExport - Whether to skip exporting the inserted operation
   * @returns Inserted operation reference with generated value
   * 
   * @example Inserting helper operations
   * ```typescript
   * class CrudApiClient extends OperationBase {
   *   toDefinition(): Definition {
   *     // Insert a related validation operation
   *     const validator = this.insertOperation(
   *       new ValidationOperation({ ... }),
   *       this.operation,
   *       { noExport: true }
   *     );
   *     
   *     return new Definition({
   *       name: this.operation.operationId,
   *       content: `async ${this.operation.operationId}(data: any) {
   *         ${validator.value}(data);
   *         return this.request('${this.operation.method}', '${this.operation.path}', data);
   *       }`
   *     });
   *   }
   * }
   * ```
   */
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
