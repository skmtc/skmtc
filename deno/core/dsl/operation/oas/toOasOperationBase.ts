import { toOperationGeneratorKey } from '@/dsl/GeneratorKeys.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import type { OasOperation } from '@/oas/operation/Operation.ts'
import { OasOperationBase } from '@/dsl/operation/oas/OasOperationBase.ts'
import type { Identifier } from '@/dsl/Identifier.ts'
import type { OasOperationInsertableArgs } from '@/dsl/operation/oas/types.ts'
import * as v from 'valibot'
// @deno-types="npm:@types/lodash-es@4.17.12/get.d.ts"
import get from 'lodash-es/get'

/**
 * Configuration for creating a base operation class.
 *
 * Defines the structure and behavior for operation generators, including
 * identifier generation, export path resolution, and enrichment schemas.
 *
 * @template EnrichmentType - Type of enrichments to apply to generated operations
 */
export type BaseOasOperationConfig<EnrichmentType = undefined> = {
  /** Unique identifier for the operation generator */
  id: string
  /** Function to generate identifiers from operations */
  toIdentifier: (operation: OasOperation) => Identifier
  /** Function to generate export paths from operations */
  toExportPath: (operation: OasOperation) => string
  /** Optional function to provide enrichment validation schema */
  toEnrichmentSchema?: () => v.BaseSchema<EnrichmentType, EnrichmentType, v.BaseIssue<unknown>>
}

type ToEnrichmentsArgs = {
  operation: OasOperation
  context: GenerateContextType
}

/**
 * Creates a base operation class constructor for generating type-safe operation artifacts.
 *
 * This factory function creates a specialized OasOperationBase class that implements
 * the provided configuration for identifier generation, export paths, and
 * enrichment handling. The resulting class can be instantiated to generate
 * operation artifacts from OpenAPI operations.
 *
 * @template EnrichmentType - Type of enrichments to apply to generated operations
 * @param config - Configuration defining the operation generation behavior
 * @returns Constructor function for creating operation instances
 *
 * @example Creating a TypeScript function generator
 * ```typescript
 * import { toOasOperationBase } from '@skmtc/core';
 *
 * const TypeScriptOasOperationBase = toOasOperationBase({
 *   id: 'typescript-functions',
 *   toIdentifier: (operation) => new Identifier(camelCase(operation.operationId)),
 *   toExportPath: (operation) => `./operations/${kebabCase(operation.operationId)}.ts`,
 *   toEnrichmentSchema: () => v.object({
 *     includeValidation: v.optional(v.boolean()),
 *     asyncMode: v.optional(v.boolean())
 *   })
 * });
 *
 * class TypeScriptOperationGenerator extends TypeScriptOasOperationBase {
 *   generate() {
 *     const enrichments = this.enrichments;
 *     const functionCode = generateFunction(this.operation, {
 *       async: enrichments?.asyncMode ?? true
 *     });
 *     this.register({ file: this.createFile(functionCode) });
 *   }
 * }
 * ```
 *
 * @example Creating a React hook generator
 * ```typescript
 * const ReactHookOasOperationBase = toOasOperationBase({
 *   id: 'react-hooks',
 *   toIdentifier: (operation) => new Identifier(`use${pascalCase(operation.operationId)}`),
 *   toExportPath: (operation) => `./hooks/${kebabCase(operation.operationId)}.hook.ts`
 * });
 * ```
 */
export const toOasOperationBase = <EnrichmentType = undefined>(
  config: BaseOasOperationConfig<EnrichmentType>
) => {
  return class extends OasOperationBase<EnrichmentType> {
    static id = config.id
    static type = 'oasOperation' as const

    static toIdentifier = config.toIdentifier.bind(config)
    static toExportPath = config.toExportPath.bind(config)

    static toEnrichments = ({ operation, context }: ToEnrichmentsArgs): EnrichmentType => {
      const operationEnrichments = get(
        context.settings,
        `enrichments.${config.id}.${operation.path}.${operation.method}`
      )

      const enrichmentSchema = config.toEnrichmentSchema?.() ?? v.optional(v.unknown())

      return v.parse(enrichmentSchema, operationEnrichments) as EnrichmentType
    }

    constructor(args: OasOperationInsertableArgs<EnrichmentType>) {
      super({
        ...args,
        generatorKey: toOperationGeneratorKey({
          generatorId: config.id,
          operation: args.operation
        })
      })
    }
  }
}
