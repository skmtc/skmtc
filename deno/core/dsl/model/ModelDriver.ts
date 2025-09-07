import type { ModelInsertable } from './types.ts'
import type { GenerateContext } from '../../context/GenerateContext.ts'
import type { ContentSettings } from '../ContentSettings.ts'
import { normalize } from '@std/path/normalize'
import { Definition } from '../Definition.ts'
import type { Identifier } from '../Identifier.ts'
import type { GeneratedDefinition, GenerationType } from '../../types/GeneratedValue.ts'
import type { GeneratedValue } from '../../types/GeneratedValue.ts'
import type { RefName } from '../../types/RefName.ts'
import { toModelGeneratorKey } from '../../types/GeneratorKeys.ts'

type CreateModelArgs<V extends GeneratedValue, T extends GenerationType, EnrichmentType> = {
  context: GenerateContext
  insertable: ModelInsertable<V, EnrichmentType>
  refName: RefName
  generation?: T
  destinationPath?: string
  rootRef?: RefName
  noExport?: boolean
}
type ApplyArgs<T extends GenerationType> = {
  generation?: T
  destinationPath?: string
}

type GetDefinitionArgs = {
  identifier: Identifier
  exportPath: string
  noExport?: boolean
}

/**
 * Driver class responsible for managing model generation lifecycle.
 * 
 * @template V - The generated value type
 * @template T - The generation type
 * @template EnrichmentType - Optional enrichment type
 */
export class ModelDriver<V extends GeneratedValue, T extends GenerationType, EnrichmentType> {
  /** The generation context */
  context: GenerateContext
  /** The insertable model configuration */
  insertable: ModelInsertable<V, EnrichmentType>
  /** Reference name for the model */
  refName: RefName
  /** Content settings for the model */
  settings: ContentSettings<EnrichmentType>
  /** Optional destination path for the generated file */
  destinationPath?: string
  /** The generated definition */
  definition: GeneratedDefinition<V, T>
  /** Optional root reference name */
  rootRef?: RefName
  /** Whether to skip export declaration */
  noExport?: boolean

  /**
   * Creates a new ModelDriver instance.
   * 
   * @param args - Constructor arguments
   * @param args.context - Generation context
   * @param args.insertable - Model insertable configuration
   * @param args.refName - Reference name for the model
   * @param args.generation - Optional generation type
   * @param args.destinationPath - Optional destination path
   * @param args.rootRef - Optional root reference name
   * @param args.noExport - Whether to skip export declaration
   */
  constructor({
    context,
    insertable,
    refName,
    generation,
    destinationPath,
    rootRef,
    noExport
  }: CreateModelArgs<V, T, EnrichmentType>) {
    this.context = context
    this.insertable = insertable
    this.refName = refName
    this.destinationPath = destinationPath
    this.rootRef = rootRef
    this.noExport = noExport

    this.context.modelDepth[`${insertable.id}:${refName}`] = 0

    this.settings = this.context.toModelContentSettings({ refName, insertable })
    this.definition = this.apply({ generation, destinationPath })

    this.context.modelDepth[`${insertable.id}:${refName}`] = 0
  }

  /**
   * Applies generation configuration to create the model definition.
   * 
   * This method handles the core generation logic, including identifier resolution,
   * export path management, and import registration for cross-file dependencies.
   * 
   * @template T - The generation type
   * @param args - Apply configuration arguments
   * @param args.generation - Optional generation type (unused currently)
   * @param args.destinationPath - Optional destination path for imports
   * @returns Generated definition for the model
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
   * Retrieves or creates a definition for the model.
   * 
   * This method first checks for cached definitions to avoid duplicate generation,
   * then creates a new definition if none exists. It handles the complete model
   * transformation process including schema resolution and value generation.
   * 
   * @param args - Definition retrieval arguments
   * @param args.identifier - The identifier for the definition
   * @param args.exportPath - The export path for the definition
   * @returns Model definition instance
   */
  private getDefinition({ identifier, exportPath }: GetDefinitionArgs): Definition<V> {
    const cachedDefinition = this.context.findDefinition({
      name: identifier.name,
      exportPath
    })

    if (this.affirmDefinition<V>(cachedDefinition, exportPath)) {
      return cachedDefinition
    }

    // const [previous, current] = this.context.stackTrail.slice(-2).stackTrail

    // if (
    //   previous === this.insertable.id &&
    //   current === this.refName &&
    //   this.refName === this.rootRef
    // ) {
    //   this.context.modelDepth++
    // }

    const value = new this.insertable({
      refName: this.refName,
      context: this.context,
      settings: this.settings,
      destinationPath: this.settings.exportPath,
      rootRef: this.rootRef
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

    const currentKey = toModelGeneratorKey({
      generatorId: this.insertable.id,
      refName: this.refName
    })

    if (currentKey !== definition.generatorKey) {
      throw new Error(
        `Registered definition mismatch: '${definition.identifier.name}' in file '${exportPath}'. Cached key '${definition.generatorKey}' does not match new key '${currentKey}'`
      )
    }

    return definition.value instanceof this.insertable
  }
}
