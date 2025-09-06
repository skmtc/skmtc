import type {
  GeneratedDefinition,
  GeneratedValue,
  GenerationType
} from '../types/GeneratedValue.ts'
import type { ContentSettings } from './ContentSettings.ts'
import type { Identifier } from './Identifier.ts'

/**
 * Constructor arguments for {@link Inserted}.
 * 
 * @template V - The type of generated value
 * @template T - The generation type ('force' or 'lazy')
 * @template EnrichmentType - Optional enrichment data type
 */
type ConstructorArgs<V extends GeneratedValue, T extends GenerationType, EnrichmentType> = {
  /** Content settings including identifier and export path */
  settings: ContentSettings<EnrichmentType>
  /** The generated definition with its value */
  definition: GeneratedDefinition<V, T>
}

/**
 * Represents a successfully inserted generator artifact in the SKMTC DSL system.
 * 
 * The `Inserted` class is returned when generators are inserted into the generation
 * context, providing access to the generated content, metadata, and configuration.
 * It acts as a bridge between the insertion process and the consuming code that
 * needs to reference or use the generated artifacts.
 * 
 * This class provides type-safe access to generated values with proper handling
 * of both forced and lazy generation modes, ensuring the correct optionality
 * of the generated content based on the generation strategy used.
 * 
 * ## Key Features
 * 
 * - **Type Safety**: Generic parameters preserve exact types from generators
 * - **Generation Modes**: Handles both 'force' and 'lazy' generation strategies
 * - **Metadata Access**: Provides access to identifiers, export paths, and settings
 * - **Value Extraction**: Type-safe value extraction with proper optionality
 * - **Enrichment Support**: Full support for custom enrichment data types
 * 
 * @template V - The type of generated value (preserves generator output type)
 * @template T - The generation type ('force' ensures non-null, 'lazy' allows undefined)
 * @template EnrichmentType - Optional type for custom enrichment data
 * 
 * @example Basic usage with forced generation
 * ```typescript
 * import { Inserted } from '@skmtc/core';
 * 
 * class MyGenerator extends ModelBase {
 *   generate(): Definition {
 *     // Insert a related model with forced generation
 *     const userModel = this.insertModel(
 *       new UserModelGenerator({ ... }),
 *       'User'
 *     ); // Returns Inserted<UserModelValue, 'force', EnrichmentType>
 *     
 *     // Access the generated value (guaranteed to be present)
 *     const userTypeName = userModel.toValue(); // UserModelValue (not undefined)
 *     const exportPath = userModel.toExportPath(); // './src/models.ts'
 *     const identifier = userModel.toName(); // 'User'
 *     
 *     return new Definition({
 *       identifier: Identifier.createType(this.refName),
 *       value: {
 *         generatorKey: this.generatorKey,
 *         content: `export interface Order { user: ${userTypeName}; }`
 *       }
 *     });
 *   }
 * }
 * ```
 * 
 * @example Working with lazy generation
 * ```typescript
 * class ConditionalGenerator extends ModelBase {
 *   generate(): Definition {
 *     // Insert with lazy generation (may not generate if already exists)
 *     const optionalModel = this.insertModel(
 *       new OptionalModelGenerator({ ... }),
 *       'OptionalModel',
 *       { generation: 'lazy' }
 *     ); // Returns Inserted<OptionalValue, 'lazy', EnrichmentType>
 *     
 *     // Value might be undefined with lazy generation
 *     const value = optionalModel.toValue(); // OptionalValue | undefined
 *     
 *     if (value) {
 *       // Use the generated value
 *       return this.createDefinitionWith(value);
 *     } else {
 *       // Handle case where generation was skipped
 *       return this.createFallbackDefinition();
 *     }
 *   }
 * }
 * ```
 * 
 * @example Accessing insertion metadata
 * ```typescript
 * class MetadataAwareGenerator extends OperationBase {
 *   generate(): Definition {
 *     const requestModel = this.insertModel(
 *       new RequestModelGenerator({ ... }),
 *       'CreateUserRequest'
 *     );
 *     
 *     // Access various metadata
 *     const modelName = requestModel.toName(); // 'CreateUserRequest'
 *     const identifier = requestModel.toIdentifier(); // Full Identifier object
 *     const exportPath = requestModel.toExportPath(); // './src/api/types.ts'
 *     const enrichments = requestModel.settings.enrichments; // Custom data
 *     
 *     console.log(`Generated ${modelName} in ${exportPath}`);
 *     
 *     return new Definition({
 *       identifier: Identifier.createVariable(this.operation.operationId!),
 *       value: {
 *         generatorKey: this.generatorKey,
 *         content: `async function createUser(data: ${modelName}) { ... }`
 *       }
 *     });
 *   }
 * }
 * ```
 * 
 * @example With enrichment data
 * ```typescript
 * type ValidationEnrichment = {
 *   validators: string[];
 *   required: boolean;
 * };
 * 
 * class EnrichedGenerator extends ModelBase<ValidationEnrichment> {
 *   generate(): Definition {
 *     const validatedModel = this.insertModel(
 *       new ValidatedModelGenerator({ ... }),
 *       'ValidatedUser'
 *     ); // Returns Inserted<ModelValue, 'force', ValidationEnrichment>
 *     
 *     // Access enrichment data
 *     const enrichment = validatedModel.settings.enrichments;
 *     const validators = enrichment?.validators ?? [];
 *     const isRequired = enrichment?.required ?? false;
 *     
 *     return new Definition({
 *       identifier: Identifier.createType(this.refName),
 *       value: {
 *         generatorKey: this.generatorKey,
 *         content: this.generateWithValidation(validatedModel.toValue(), validators)
 *       }
 *     });
 *   }
 * }
 * ```
 */
export class Inserted<V extends GeneratedValue, T extends GenerationType, EnrichmentType> {
  /** Content settings including identifier and export path */
  settings: ContentSettings<EnrichmentType>
  
  /** The generated definition with its value */
  definition: GeneratedDefinition<V, T>

  /**
   * Creates a new Inserted instance.
   * 
   * @param args - Insertion configuration
   * @param args.settings - Content settings with identifier and export path
   * @param args.definition - The generated definition containing the value
   */
  constructor({ settings, definition }: ConstructorArgs<V, T, EnrichmentType>) {
    this.settings = settings
    this.definition = definition
  }

  /**
   * Gets the name of the inserted artifact.
   * 
   * This method returns the string name from the identifier, which is commonly
   * used when referencing the generated artifact in code or templates.
   * 
   * @returns The name of the inserted artifact
   * 
   * @example
   * ```typescript
   * const userModel = this.insertModel(generator, 'User');
   * const name = userModel.toName(); // 'User'
   * 
   * // Use in generated code
   * const code = `interface Order { user: ${name}; }`;
   * ```
   */
  toName(): string {
    return this.settings.identifier.name
  }

  /**
   * Gets the full identifier of the inserted artifact.
   * 
   * This method returns the complete Identifier object, which includes both
   * the name and type information. Useful when you need access to entity type
   * or type annotations.
   * 
   * @returns The complete Identifier object
   * 
   * @example
   * ```typescript
   * const model = this.insertModel(generator, 'User');
   * const identifier = model.toIdentifier();
   * 
   * console.log(identifier.name);        // 'User'
   * console.log(identifier.entityType);  // EntityType instance
   * console.log(identifier.typeName);    // Optional type annotation
   * ```
   */
  toIdentifier(): Identifier {
    return this.settings.identifier
  }

  /**
   * Gets the export path where the artifact was generated.
   * 
   * This method returns the file path where the generated artifact is located,
   * which is useful for creating import statements or understanding the file
   * structure of generated code.
   * 
   * @returns The export path of the generated artifact
   * 
   * @example
   * ```typescript
   * const userModel = this.insertModel(generator, 'User');
   * const exportPath = userModel.toExportPath(); // './src/models/User.ts'
   * 
   * // Create import statement
   * const importStmt = `import { User } from '${exportPath}';`;
   * ```
   */
  toExportPath(): string {
    return this.settings.exportPath
  }

  /**
   * Gets the generated value from the inserted artifact.
   * 
   * This method returns the actual generated content with proper type safety
   * based on the generation mode. For 'force' generation, the value is guaranteed
   * to be present. For 'lazy' generation, the value might be undefined if
   * generation was skipped.
   * 
   * @returns The generated value, with optionality based on generation type
   * 
   * @example Forced generation (guaranteed value)
   * ```typescript
   * const userModel = this.insertModel(generator, 'User'); // 'force' by default
   * const value = userModel.toValue(); // UserModelValue (never undefined)
   * 
   * // Safe to use directly
   * const code = `type OrderUser = ${value};`;
   * ```
   * 
   * @example Lazy generation (optional value)
   * ```typescript
   * const optionalModel = this.insertModel(generator, 'Optional', { generation: 'lazy' });
   * const value = optionalModel.toValue(); // OptionalValue | undefined
   * 
   * if (value) {
   *   // Use the generated value
   *   const code = `type Optional = ${value};`;
   * } else {
   *   // Handle missing value (generation was skipped)
   *   const code = 'type Optional = any; // Fallback';
   * }
   * ```
   */
  toValue(): T extends 'force' ? V : V | undefined {
    return this.definition?.value as T extends 'force' ? V : V | undefined
  }
}
