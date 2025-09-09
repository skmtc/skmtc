import type { GenerateContext } from '../../context/GenerateContext.ts'
import { toModelGeneratorKey } from '../../types/GeneratorKeys.ts'
import type { RefName } from '../../types/RefName.ts'
import type { ContentSettings } from '../ContentSettings.ts'
import { ModelBase } from './ModelBase.ts'
import type { Identifier } from '../Identifier.ts'
import * as v from 'valibot'
// @deno-types="npm:@types/lodash-es@4.17.12"
import { get } from 'npm:lodash-es@4.17.21'
import type { ModelInsertable } from './types.ts'

/**
 * Arguments for creating a model insertable instance.
 *
 * @template EnrichmentType - Type of enrichments to apply to the model
 */
export type ModelInsertableArgs<EnrichmentType = undefined> = {
  /** The generation context providing access to OAS objects and utilities */
  context: GenerateContext
  /** Content settings for customizing model generation behavior */
  settings: ContentSettings<EnrichmentType>
  /** Reference name identifying the model schema */
  refName: RefName
}

type ToEnrichmentsArgs = {
  refName: RefName
  context: GenerateContext
}

/**
 * Configuration for creating a base model class.
 *
 * Defines the structure and behavior for model generators, including
 * identifier generation, export path resolution, and enrichment schemas.
 *
 * @template EnrichmentType - Type of enrichments to apply to generated models
 */
export type BaseModelConfig<EnrichmentType = undefined> = {
  /** Unique identifier for the model generator */
  id: string
  /** Function to generate identifiers from reference names */
  toIdentifier: (refName: RefName) => Identifier
  /** Function to generate export paths from reference names */
  toExportPath: (refName: RefName) => string
  /** Optional function to provide enrichment validation schema */
  toEnrichmentSchema?: () => v.BaseSchema<EnrichmentType, EnrichmentType, v.BaseIssue<unknown>>
}

/**
 * Creates a base model class constructor for generating type-safe model artifacts.
 *
 * This factory function creates a specialized ModelBase class that implements
 * the provided configuration for identifier generation, export paths, and
 * enrichment handling. The resulting class can be instantiated to generate
 * model artifacts from OpenAPI schemas.
 *
 * @template EnrichmentType - Type of enrichments to apply to generated models
 * @param config - Configuration defining the model generation behavior
 * @returns Constructor function for creating model instances
 *
 * @example Creating a TypeScript interface generator
 * ```typescript
 * import { toModelBase } from '@skmtc/core';
 *
 * const TypeScriptModelBase = toModelBase({
 *   id: 'typescript-interfaces',
 *   toIdentifier: (refName) => new Identifier(pascalCase(refName)),
 *   toExportPath: (refName) => `./models/${kebabCase(refName)}.ts`,
 *   toEnrichmentSchema: () => v.object({
 *     includeValidation: v.optional(v.boolean()),
 *     readonly: v.optional(v.boolean())
 *   })
 * });
 *
 * class TypeScriptModelGenerator extends TypeScriptModelBase {
 *   generate() {
 *     const enrichments = this.enrichments;
 *     const interface = generateInterface(this.schema, {
 *       readonly: enrichments?.readonly ?? false
 *     });
 *     this.register({ file: this.createFile(interface) });
 *   }
 * }
 * ```
 *
 * @example Creating a validation schema generator
 * ```typescript
 * const ValidationModelBase = toModelBase({
 *   id: 'zod-schemas',
 *   toIdentifier: (refName) => new Identifier(`${pascalCase(refName)}Schema`),
 *   toExportPath: (refName) => `./schemas/${kebabCase(refName)}.schema.ts`
 * });
 * ```
 */
export const toModelBase = <EnrichmentType = undefined>(
  config: BaseModelConfig<EnrichmentType>
) => {
  return class extends ModelBase<EnrichmentType> {
    static id = config.id
    static type = 'model' as const

    static toIdentifier = config.toIdentifier.bind(config)
    static toExportPath = config.toExportPath.bind(config)
    static toEnrichments = ({ refName, context }: ToEnrichmentsArgs): EnrichmentType => {
      const modelEnrichments = get(context.settings, `enrichments.${config.id}.${refName}`)

      const enrichmentSchema = config.toEnrichmentSchema?.() ?? v.undefined()

      return v.parse(enrichmentSchema, modelEnrichments) as EnrichmentType
    }
    static isSupported = () => true

    constructor(args: ModelInsertableArgs<EnrichmentType>) {
      super({
        ...args,
        generatorKey: toModelGeneratorKey({
          generatorId: config.id,
          refName: args.refName
        })
      })
    }
  }
}
