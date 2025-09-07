import type {
  BaseRegisterArgs,
  GenerateContext,
  InsertModelOptions,
  InsertNormalisedModelArgs,
  InsertNormalisedModelReturn
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
import type { OasVoid } from '../../oas/void/Void.ts'

/**
 * Constructor arguments for {@link ModelBase}.
 *
 * @template EnrichmentType - Optional type for custom enrichment data
 */
export type ModelBaseArgs<EnrichmentType = undefined> = {
  /** The generation context providing access to the processing pipeline */
  context: GenerateContext
  /** Content settings including export path and enrichment configuration */
  settings: ContentSettings<EnrichmentType>
  /** Unique identifier for this generator type */
  generatorKey: GeneratorKey
  /** Reference name for the model being generated */
  refName: RefName
}

/**
 * Base class for model generators in the SKMTC DSL system.
 *
 * `ModelBase` extends {@link ContentBase} to provide specialized functionality for
 * generating code from OpenAPI schema models. It offers type-safe methods for
 * inserting related models, managing schema references, and handling enrichments.
 *
 * This class serves as the foundation for creating custom model generators that
 * transform OpenAPI schemas into various code artifacts like TypeScript interfaces,
 * validation schemas, or database models.
 *
 * ## Key Features
 *
 * - **Model Insertion**: Insert related models with automatic reference resolution
 * - **Schema Normalization**: Handle complex schema references and fallbacks
 * - **Export Management**: Control which models are exported from generated files
 * - **Enrichment Support**: Extend functionality with custom enrichment data
 * - **Type Safety**: Full TypeScript support with generic enrichment types
 *
 * @template EnrichmentType - Optional type for custom enrichment data
 *
 * @example Basic model generator
 * ```typescript
 * import { ModelBase, Definition } from '@skmtc/core';
 *
 * class TypeScriptInterface extends ModelBase {
 *   toDefinition(): Definition {
 *     const schema = this.context.getSchema(this.refName);
 *
 *     return new Definition({
 *       name: this.refName,
 *       content: `export interface ${this.refName} {
 *         ${this.generateProperties(schema)}
 *       }`
 *     });
 *   }
 *
 *   private generateProperties(schema: OasSchema): string {
 *     // Generate interface properties from schema
 *     return Object.entries(schema.properties || {})
 *       .map(([key, prop]) => `${key}: ${this.getPropertyType(prop)}`)
 *       .join(';\n  ');
 *   }
 * }
 * ```
 *
 * @example With enrichments
 * ```typescript
 * type ValidationEnrichment = {
 *   validators: string[];
 *   customRules: Record<string, string>;
 * };
 *
 * class ValidationModel extends ModelBase<ValidationEnrichment> {
 *   toDefinition(): Definition {
 *     const enrichment = this.settings.enrichment;
 *     const validators = enrichment?.validators || [];
 *
 *     return new Definition({
 *       name: `${this.refName}Validator`,
 *       content: this.generateValidator(validators)
 *     });
 *   }
 * }
 * ```
 *
 * @example Inserting related models
 * ```typescript
 * class ApiModel extends ModelBase {
 *   toDefinition(): Definition {
 *     const schema = this.context.getSchema(this.refName);
 *
 *     // Insert related models automatically
 *     if (schema.properties?.user) {
 *       this.insertNormalizedModel(
 *         new TypeScriptInterface({ ... }),
 *         { schema: schema.properties.user, fallbackName: 'User' }
 *       );
 *     }
 *
 *     return new Definition({
 *       name: this.refName,
 *       content: this.generateInterface(schema)
 *     });
 *   }
 * }
 * ```
 */
export class ModelBase<EnrichmentType = undefined> extends ContentBase {
  /** Content settings including export path and enrichment configuration */
  settings: ContentSettings<EnrichmentType>

  /** Reference name for the model being generated */
  refName: RefName

  /** Generator key identifying this generator type */
  override generatorKey: GeneratorKey

  /**
   * Creates a new ModelBase instance.
   *
   * @param args - Model generator configuration
   * @param args.context - The generation context providing pipeline access
   * @param args.settings - Content settings with export path and enrichments
   * @param args.generatorKey - Unique identifier for this generator type
   * @param args.refName - Reference name for the model being generated
   *
   * @example
   * ```typescript
   * const model = new ModelBase({
   *   context: generateContext,
   *   settings: {
   *     exportPath: './src/models.ts',
   *     enrichment: customEnrichments
   *   },
   *   generatorKey: 'typescript-models',
   *   refName: 'UserModel'
   * });
   * ```
   */
  constructor({ context, settings, generatorKey, refName }: ModelBaseArgs<EnrichmentType>) {
    super({ context })

    this.generatorKey = generatorKey
    this.refName = refName
    this.settings = settings
  }

  /**
   * Inserts a related model with forced generation.
   *
   * This method adds a related model to the current generation context, ensuring
   * it will be generated regardless of whether it already exists. The inserted
   * model will be exported to the same destination path as this model unless
   * `noExport` is specified.
   *
   * @template V - Type of generated value returned by the insertable
   * @template EnrichmentType - Type of enrichment data for the insertable
   * @param insertable - The model generator to insert
   * @param refName - Reference name for the inserted model
   * @param options - Insertion options
   * @param options.noExport - Whether to skip exporting the inserted model
   * @returns Inserted model reference with generated value
   *
   * @example
   * ```typescript
   * class UserModel extends ModelBase {
   *   toDefinition(): Definition {
   *     // Insert an address model that's always generated
   *     const address = this.insertModel(
   *       new AddressModel({ ... }),
   *       'Address',
   *       { noExport: false }
   *     );
   *
   *     return new Definition({
   *       name: this.refName,
   *       content: `export interface ${this.refName} {
   *         address: ${address.value}
   *       }`
   *     });
   *   }
   * }
   * ```
   */
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

  /**
   * Inserts a related model with automatic schema normalization and reference resolution.
   *
   * This method intelligently handles schema references by automatically resolving
   * them to appropriate model names. If the schema is a reference, it uses the
   * referenced name; otherwise it falls back to the provided fallback name.
   *
   * This is particularly useful when working with complex nested schemas where
   * you want to automatically generate models for referenced types.
   *
   * @template V - Type of generated value returned by the insertable
   * @template Schema - Type of OpenAPI schema (schema object, reference, or void)
   * @template EnrichmentType - Type of enrichment data for the insertable
   * @param insertable - The model generator to insert
   * @param args - Schema normalization arguments
   * @param args.schema - The OpenAPI schema to normalize (can be reference or actual schema)
   * @param args.fallbackName - Name to use if schema is not a reference
   * @param options - Insertion options
   * @param options.noExport - Whether to skip exporting the inserted model
   * @returns Inserted model reference with normalized name and generated value
   *
   * @example Handling schema references
   * ```typescript
   * class OrderModel extends ModelBase {
   *   toDefinition(): Definition {
   *     const schema = this.context.getSchema(this.refName);
   *
   *     // Handle customer property - could be reference or inline schema
   *     if (schema.properties?.customer) {
   *       const customer = this.insertNormalizedModel(
   *         new CustomerModel({ ... }),
   *         {
   *           schema: schema.properties.customer,
   *           fallbackName: 'Customer'
   *         }
   *       );
   *       // customer.refName will be 'Customer' or the referenced schema name
   *     }
   *
   *     return new Definition({ ... });
   *   }
   * }
   * ```
   *
   * @example With complex nested schemas
   * ```typescript
   * // If schema.properties.items is { $ref: '#/components/schemas/Product' }
   * // Then the inserted model will use refName 'Product'
   * const items = this.insertNormalizedModel(
   *   new ProductModel({ ... }),
   *   {
   *     schema: schema.properties.items,
   *     fallbackName: 'Item' // Won't be used since schema has $ref
   *   }
   * );
   * ```
   */
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

  /**
   * Registers a file-level artifact with the generation context.
   *
   * This method allows the model generator to register additional content
   * (like imports, exports, or file-level definitions) that should be included
   * in the generated file. The registration is automatically scoped to this
   * model's export path.
   *
   * @param args - Registration arguments
   * @param args.content - The content to register (import, export, etc.)
   * @param args.phase - When to register the content ('pre' or 'post')
   *
   * @example Registering imports
   * ```typescript
   * class ApiModel extends ModelBase {
   *   toDefinition(): Definition {
   *     // Register an import that all generated models need
   *     this.register({
   *       content: "import { BaseModel } from './base';",
   *       phase: 'pre'
   *     });
   *
   *     return new Definition({ ... });
   *   }
   * }
   * ```
   *
   * @example Registering type exports
   * ```typescript
   * class TypeModel extends ModelBase {
   *   toDefinition(): Definition {
   *     this.register({
   *       content: "export type * from './types';",
   *       phase: 'post'
   *     });
   *
   *     return new Definition({ ... });
   *   }
   * }
   * ```
   */
  override register(args: BaseRegisterArgs): void {
    this.context.register({
      ...args,
      destinationPath: this.settings.exportPath
    })
  }
}
