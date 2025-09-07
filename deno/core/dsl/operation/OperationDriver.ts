import type { OperationInsertable } from './types.ts'
import type { OasOperation } from '../../oas/operation/Operation.ts'
import type { ContentSettings } from '../ContentSettings.ts'
import { normalize } from '@std/path/normalize'
import { Definition } from '../Definition.ts'
import type { Identifier } from '../Identifier.ts'
import type { GeneratedDefinition, GenerationType } from '../../types/GeneratedValue.ts'
import type { GeneratedValue } from '../../types/GeneratedValue.ts'
import { toOperationGeneratorKey } from '../../types/GeneratorKeys.ts'
import type { GenerateContext } from '../../context/GenerateContext.ts'

type CreateOperationArgs<
  V extends GeneratedValue,
  T extends GenerationType,
  EnrichmentType = undefined
> = {
  context: GenerateContext
  insertable: OperationInsertable<V, EnrichmentType>
  operation: OasOperation
  generation?: T
  destinationPath?: string
  noExport?: boolean
}

type ApplyArgs<T extends GenerationType> = {
  generation?: T
  destinationPath?: string
}

type GetDefinitionArgs = {
  identifier: Identifier
  exportPath: string
}

/**
 * Driver class for generating operation-based artifacts from OpenAPI operations.
 * 
 * The `OperationDriver` manages the transformation of OpenAPI operation objects
 * into code artifacts, handling path generation, identifier resolution, and
 * definition management. It serves as the core orchestrator for operation-based
 * code generation in the SKMTC pipeline.
 * 
 * @template V - Type of generated values produced by this driver
 * @template T - Type of generation strategy (e.g., 'function', 'class', 'hook')
 * @template EnrichmentType - Type of enrichments that can be applied
 * 
 * @example Basic usage in an operation generator
 * ```typescript
 * class APIClientGenerator extends OperationBase {
 *   generate() {
 *     const driver = new OperationDriver({
 *       context: this.context,
 *       insertable: this,
 *       operation: this.operation,
 *       generation: 'function'
 *     });
 * 
 *     const functionCode = driver.definition.toValueString();
 *     const file = this.createFile(functionCode);
 *     this.register({ file });
 *   }
 * }
 * ```
 */
export class OperationDriver<
  V extends GeneratedValue,
  T extends GenerationType,
  EnrichmentType = undefined
> {
  /** The generation context providing access to OAS objects and utilities */
  context: GenerateContext
  /** The insertable object that provides generation configuration */
  insertable: OperationInsertable<V, EnrichmentType>
  /** The OpenAPI operation object being processed */
  operation: OasOperation
  /** Content settings for customizing generation behavior */
  settings: ContentSettings<EnrichmentType>
  /** Optional custom destination path for generated files */
  destinationPath?: string
  /** The generated definition containing the transformed operation */
  definition: GeneratedDefinition<V, T>
  /** Whether to exclude this operation from exports */
  noExport?: boolean

  /**
   * Creates a new OperationDriver instance.
   * 
   * @param args - Configuration for the operation driver
   * @param args.context - Generation context
   * @param args.insertable - Insertable providing generation configuration
   * @param args.operation - OpenAPI operation to process
   * @param args.generation - Optional generation type
   * @param args.destinationPath - Optional custom destination path
   * @param args.noExport - Whether to exclude from exports
   */
  constructor({
    context,
    insertable,
    operation,
    generation,
    destinationPath,
    noExport
  }: CreateOperationArgs<V, T, EnrichmentType>) {
    this.context = context
    this.insertable = insertable
    this.operation = operation
    this.destinationPath = destinationPath
    this.noExport = noExport
    this.settings = this.context.toOperationContentSettings({
      operation,
      insertable
    })

    this.definition = this.apply({ generation, destinationPath })
  }

  /**
   * Applies generation configuration to create the operation definition.
   * 
   * This method handles the core generation logic for operations, including
   * identifier resolution, export path management, and import registration
   * for cross-file dependencies.
   * 
   * @template T - The generation type
   * @param args - Apply configuration arguments
   * @param args.generation - Optional generation type (unused currently)
   * @param args.destinationPath - Optional destination path for imports
   * @returns Generated definition for the operation
   */
  private apply<T extends GenerationType>({
    generation: _generation,
    destinationPath
  }: ApplyArgs<T> = {}): GeneratedDefinition<V, T> {
    const { identifier, exportPath } = this.settings

    // Everything is selected (for now)
    // if (/*!selected && */ generation !== 'force') {
    //   return undefined as GeneratedDefinition<V, T>
    // }

    const definition = this.getDefinition({ identifier, exportPath })

    if (destinationPath && normalize(exportPath) !== normalize(destinationPath)) {
      this.context.register({
        imports: { [exportPath]: [identifier.name] },
        destinationPath
      })
    }

    return definition
  }

  /**
   * Retrieves or creates a definition for the operation.
   * 
   * This method first checks for cached definitions to avoid duplicate generation,
   * then creates a new definition if none exists. It handles the complete operation
   * transformation process including schema resolution and value generation.
   * 
   * @param args - Definition retrieval arguments
   * @param args.identifier - The identifier for the definition
   * @param args.exportPath - The export path for the definition
   * @returns Operation definition instance
   */
  private getDefinition({ identifier, exportPath }: GetDefinitionArgs): Definition<V> {
    const cachedDefinition = this.context.findDefinition({
      name: identifier.name,
      exportPath
    })

    if (this.affirmDefinition<V>(cachedDefinition, exportPath)) {
      return cachedDefinition
    }

    const value = new this.insertable({
      context: this.context,
      operation: this.operation,
      settings: this.settings
    })

    const definition = new Definition({
      context: this.context,
      value,
      identifier,
      noExport: this.noExport
    })

    this.context.register({
      definitions: [definition],
      destinationPath: exportPath
    })

    return definition
  }

  /**
   * Type guard to verify a definition matches the expected generated value type.
   * 
   * This method performs type narrowing to ensure a cached definition is compatible
   * with the current generation requirements, including export path validation.
   * 
   * @template V - The expected generated value type
   * @param definition - The definition to verify (may be undefined)
   * @param exportPath - Expected export path for validation
   * @returns True if definition matches expected type and constraints
   */
  private affirmDefinition<V extends GeneratedValue>(
    definition: Definition | undefined,
    exportPath: string
  ): definition is Definition<V> {
    if (!definition) {
      return false
    }

    const currentKey = toOperationGeneratorKey({
      generatorId: this.insertable.id,
      operation: this.operation
    })

    if (currentKey !== definition.generatorKey) {
      throw new Error(
        `Registered definition mismatch: '${definition.identifier.name}' in file '${exportPath}'. Cached key '${definition.generatorKey}' does not match new key '${currentKey}'`
      )
    }

    return definition.value instanceof this.insertable
  }
}
