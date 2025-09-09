import { toOperationGeneratorKey } from '../../types/GeneratorKeys.ts'
import type { GenerateContext } from '../../context/GenerateContext.ts'
import type { OasOperation } from '../../oas/operation/Operation.ts'
import { OperationBase } from './OperationBase.ts'
import type { Identifier } from '../Identifier.ts'
import type { OperationInsertable, OperationInsertableArgs } from './types.ts'
import * as v from 'valibot'
// @deno-types="npm:@types/lodash-es@4.17.12"
import { get } from 'npm:lodash-es@4.17.21'

/**
 * Configuration for creating a base operation class.
 *
 * Defines the structure and behavior for operation generators, including
 * identifier generation, export path resolution, and enrichment schemas.
 *
 * @template EnrichmentType - Type of enrichments to apply to generated operations
 */
export type BaseOperationConfig<EnrichmentType = undefined> = {
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
  context: GenerateContext
}

/**
 * Creates a base operation class constructor for generating type-safe operation artifacts.
 *
 * This factory function creates a specialized OperationBase class that implements
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
 * import { toOperationBase } from '@skmtc/core';
 *
 * const TypeScriptOperationBase = toOperationBase({
 *   id: 'typescript-functions',
 *   toIdentifier: (operation) => new Identifier(camelCase(operation.operationId)),
 *   toExportPath: (operation) => `./operations/${kebabCase(operation.operationId)}.ts`,
 *   toEnrichmentSchema: () => v.object({
 *     includeValidation: v.optional(v.boolean()),
 *     asyncMode: v.optional(v.boolean())
 *   })
 * });
 *
 * class TypeScriptOperationGenerator extends TypeScriptOperationBase {
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
 * const ReactHookOperationBase = toOperationBase({
 *   id: 'react-hooks',
 *   toIdentifier: (operation) => new Identifier(`use${pascalCase(operation.operationId)}`),
 *   toExportPath: (operation) => `./hooks/${kebabCase(operation.operationId)}.hook.ts`
 * });
 * ```
 */
export const toOperationBase = <EnrichmentType = undefined>(
  config: BaseOperationConfig<EnrichmentType>
) => {
  return class extends OperationBase<EnrichmentType> {
    static id = config.id
    static type = 'operation' as const

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

    constructor(args: OperationInsertableArgs<EnrichmentType>) {
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
