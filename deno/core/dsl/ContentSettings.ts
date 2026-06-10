import type { Identifier } from '@/dsl/Identifier.ts'
import { DEFAULT_VARIANT } from '@/types/Variant.ts'

/**
 * Arguments for creating empty ContentSettings without enrichments.
 */
type EmptyArgs = {
  /** The path where generated content will be exported */
  exportPath: string
  /** The identifier for the content being generated */
  identifier: Identifier
  /**
   * The operation variant this content belongs to. Optional on
   * {@link ContentSettings.empty} — defaults to `'main'` since model
   * Projections (the primary `empty()` callers) don't participate in
   * the operation-variant axis.
   */
  variant?: string
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
  /**
   * The operation variant this content belongs to. For variants-aware
   * operation generators this carries the per-call variant name
   * (`'main'`, `'customer'`, `'line-items'`, …); for variants-unaware
   * operation generators and for model Projections it is `'main'`.
   */
  variant: string
}

/**
 * Configuration settings for content generators in the SKMTC DSL system.
 *
 * `ContentSettings` encapsulates the configuration needed by generators to
 * produce content, including where to export the generated files, how to
 * identify the content, and any custom enrichment data for extending
 * the generation process.
 *
 * This class is used by {@link ModelProjectionBase}, {@link OasOperationProjectionBase}, and
 * {@link GqlOperationProjectionBase} to configure their generation behavior,
 * providing a consistent interface for generator settings across the system.
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
 *   identifier: createType('UserModels')
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
 *   identifier: createType('ValidatedModels'),
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
 * @example Using with ModelProjectionBase
 * ```typescript
 * class ValidatedModelGenerator extends ModelProjectionBase<ValidationEnrichment> {
 *   constructor(args) {
 *     super({
 *       ...args,
 *       settings: new ContentSettings({
 *         identifier: createType(args.refName),
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
   * Operation variant this content belongs to. Carries the variant name
   * threaded from the engine's per-operation dispatch through the
   * Driver into this Projection. `'main'` for variants-unaware
   * operation generators and for model Projections.
   */
  variant: string

  /**
   * Creates a new ContentSettings instance with enrichments.
   *
   * @param args - Settings configuration
   * @param args.identifier - The identifier for the content being generated
   * @param args.exportPath - The path where generated content will be exported
   * @param args.enrichments - Custom enrichment data for extending generation
   * @param args.variant - Operation variant name (`'main'` for variants-unaware Projections)
   *
   * @example
   * ```typescript
   * const settings = new ContentSettings({
   *   identifier: createType('ApiModels'),
   *   exportPath: './src/api/models.ts',
   *   enrichments: {
   *     includeValidation: true,
   *     format: 'detailed'
   *   },
   *   variant: 'main'
   * });
   * ```
   */
  constructor({ identifier, exportPath, enrichments, variant }: CreateArgs<EnrichmentType>) {
    this.identifier = identifier
    this.exportPath = exportPath
    this.enrichments = enrichments
    this.variant = variant
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
   *   identifier: createType('SimpleModels'),
   *   exportPath: './src/models.ts'
   * });
   *
   * console.log(basicSettings.enrichments); // undefined
   *
   * // Use in generator
   * class SimpleGenerator extends ModelProjectionBase {
   *   constructor(args) {
   *     super({
   *       ...args,
   *       settings: ContentSettings.empty({
   *         identifier: createType(args.refName),
   *         exportPath: './src/simple-models.ts'
   *       })
   *     });
   *   }
   * }
   * ```
   */
  static empty({
    identifier,
    exportPath,
    variant = DEFAULT_VARIANT
  }: EmptyArgs): ContentSettings<undefined> {
    return new ContentSettings({
      identifier,
      exportPath,
      enrichments: undefined,
      variant
    })
  }
}
