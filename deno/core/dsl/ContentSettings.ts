import type { Identifier } from './Identifier.ts'

/**
 * Arguments for creating empty ContentSettings without enrichments.
 */
type EmptyArgs = {
  /** The path where generated content will be exported */
  exportPath: string
  /** The identifier for the content being generated */
  identifier: Identifier
}

/**
 * Arguments for creating ContentSettings with enrichments.
 * 
 * @template EnrichmentType - The type of enrichment data
 */
type CreateArgs<EnrichmentType = undefined> = {
  /** The identifier for the content being generated */
  identifier: Identifier
  /** The path where generated content will be exported */
  exportPath: string
  /** Custom enrichment data for extending generation */
  enrichments: EnrichmentType
}

/**
 * Configuration settings for content generators in the SKMTC DSL system.
 * 
 * `ContentSettings` encapsulates the configuration needed by generators to
 * produce content, including where to export the generated files, how to
 * identify the content, and any custom enrichment data for extending
 * the generation process.
 * 
 * This class is used by both {@link ModelBase} and {@link OperationBase}
 * to configure their generation behavior, providing a consistent interface
 * for generator settings across the system.
 * 
 * ## Key Features
 * 
 * - **Export Path Management**: Specifies where generated content should be written
 * - **Identifier Integration**: Links content to specific identifiers for naming
 * - **Enrichment Support**: Allows custom data to extend generation capabilities
 * - **Type Safety**: Generic enrichment typing for compile-time validation
 * 
 * @template EnrichmentType - The type of enrichment data (default: undefined)
 * 
 * @example Basic settings without enrichments
 * ```typescript
 * import { ContentSettings, Identifier } from '@skmtc/core';
 * 
 * const settings = ContentSettings.empty({
 *   exportPath: './src/generated/models.ts',
 *   identifier: Identifier.createType('UserModels')
 * });
 * 
 * console.log(settings.exportPath); // './src/generated/models.ts'
 * console.log(settings.enrichments); // undefined
 * ```
 * 
 * @example Settings with custom enrichments
 * ```typescript
 * type ValidationEnrichment = {
 *   validateRequired: boolean;
 *   generateComments: boolean;
 *   customValidators: string[];
 * };
 * 
 * const enrichedSettings = new ContentSettings({
 *   identifier: Identifier.createType('ValidatedModels'),
 *   exportPath: './src/models/validated.ts',
 *   enrichments: {
 *     validateRequired: true,
 *     generateComments: true,
 *     customValidators: ['email', 'phone']
 *   }
 * });
 * 
 * // Access enrichment data in generators
 * if (enrichedSettings.enrichments?.validateRequired) {
 *   // Generate validation logic
 * }
 * ```
 * 
 * @example Using with ModelBase
 * ```typescript
 * class ValidatedModelGenerator extends ModelBase<ValidationEnrichment> {
 *   constructor(args) {
 *     super({
 *       ...args,
 *       settings: new ContentSettings({
 *         identifier: Identifier.createType(args.refName),
 *         exportPath: './src/validated-models.ts',
 *         enrichments: {
 *           validateRequired: true,
 *           generateComments: false,
 *           customValidators: []
 *         }
 *       })
 *     });
 *   }
 * 
 *   toDefinition(): Definition {
 *     const validation = this.settings.enrichments?.validateRequired
 *       ? this.generateValidation()
 *       : '';
 * 
 *     return new Definition({
 *       context: this.context,
 *       identifier: this.settings.identifier,
 *       value: {
 *         generatorKey: this.generatorKey,
 *         content: `${this.generateInterface()}${validation}`
 *       }
 *     });
 *   }
 * }
 * ```
 */
export class ContentSettings<EnrichmentType = undefined> {
  /** The identifier for the content being generated */
  identifier: Identifier
  
  /** The path where generated content will be exported */
  exportPath: string
  
  /** Custom enrichment data for extending generation */
  enrichments: EnrichmentType
  
  /**
   * Creates a new ContentSettings instance with enrichments.
   * 
   * @param args - Settings configuration
   * @param args.identifier - The identifier for the content being generated
   * @param args.exportPath - The path where generated content will be exported
   * @param args.enrichments - Custom enrichment data for extending generation
   * 
   * @example
   * ```typescript
   * const settings = new ContentSettings({
   *   identifier: Identifier.createType('ApiModels'),
   *   exportPath: './src/api/models.ts',
   *   enrichments: {
   *     includeValidation: true,
 *     format: 'detailed'
   *   }
   * });
   * ```
   */
  constructor({ identifier, exportPath, enrichments }: CreateArgs<EnrichmentType>) {
    this.identifier = identifier
    this.exportPath = exportPath
    this.enrichments = enrichments
  }

  /**
   * Factory method to create ContentSettings without enrichments.
   * 
   * This is a convenience method for creating ContentSettings when no
   * custom enrichment data is needed. It explicitly sets enrichments
   * to undefined and returns a properly typed instance.
   * 
   * @param args - Basic settings arguments
   * @param args.identifier - The identifier for the content being generated
   * @param args.exportPath - The path where generated content will be exported
   * @returns ContentSettings instance with undefined enrichments
   * 
   * @example
   * ```typescript
   * const basicSettings = ContentSettings.empty({
   *   identifier: Identifier.createType('SimpleModels'),
   *   exportPath: './src/models.ts'
   * });
   * 
   * console.log(basicSettings.enrichments); // undefined
   * 
   * // Use in generator
   * class SimpleGenerator extends ModelBase {
   *   constructor(args) {
   *     super({
   *       ...args,
   *       settings: ContentSettings.empty({
   *         identifier: Identifier.createType(args.refName),
   *         exportPath: './src/simple-models.ts'
   *       })
   *     });
   *   }
   * }
   * ```
   */
  static empty({ identifier, exportPath }: EmptyArgs): ContentSettings<undefined> {
    return new ContentSettings({
      identifier,
      exportPath,
      enrichments: undefined
    })
  }
}
