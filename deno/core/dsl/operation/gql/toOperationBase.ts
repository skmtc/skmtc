import type { GenerateContextType } from '@/context/generateTypes.ts'
import type { GqlOperation } from '@/gql/operation/GqlOperation.ts'
import { GqlOperationBase } from './OperationBase.ts'
import type { Identifier } from '@/dsl/Identifier.ts'
import type { GqlOperationInsertableArgs } from './types.ts'
import type { GeneratorKey } from '@/dsl/GeneratorKeys.ts'
import * as v from 'valibot'
// @deno-types="npm:@types/lodash-es@4.17.12/get.d.ts"
import get from 'lodash-es/get'

/**
 * Configuration for creating a base GraphQL operation class.
 *
 * Defines the structure and behavior for GraphQL operation generators, including
 * identifier generation, export path resolution, and enrichment schemas.
 *
 * @template EnrichmentType - Type of enrichments to apply to generated operations
 */
export type BaseGqlOperationConfig<EnrichmentType = undefined> = {
  /** Unique identifier for the operation generator */
  id: string
  /** Function to generate identifiers from operations */
  toIdentifier: (operation: GqlOperation) => Identifier
  /** Function to generate export paths from operations */
  toExportPath: (operation: GqlOperation) => string
  /** Optional function to provide enrichment validation schema */
  toEnrichmentSchema?: () => v.BaseSchema<EnrichmentType, EnrichmentType, v.BaseIssue<unknown>>
}

type ToEnrichmentsArgs = {
  operation: GqlOperation
  context: GenerateContextType
}

/**
 * Builds the operation generator key for a GraphQL operation.
 *
 * Mirrors the OAS `toOperationGeneratorKey` shape (`generatorId|path|method`)
 * but uses `rootKind` and `fieldName` in the path/method positions —
 * `${generatorId}|${rootKind}|${fieldName}`. The result is cast to
 * `GeneratorKey` because the brand expects an HTTP `Method` literal in the
 * final segment; for GraphQL we deliberately diverge from that.
 */
const toGqlOperationGeneratorKey = ({
  generatorId,
  operation
}: {
  generatorId: string
  operation: GqlOperation
}): GeneratorKey => {
  return `${generatorId}|${operation.rootKind}|${operation.fieldName}` as unknown as GeneratorKey
}

/**
 * Creates a base GraphQL operation class constructor for generating type-safe
 * operation artifacts.
 *
 * This factory function creates a specialized `GqlOperationBase` class that implements
 * the provided configuration for identifier generation, export paths, and enrichment
 * handling. The resulting class can be instantiated to generate operation artifacts
 * from GraphQL root-field operations.
 *
 * @template EnrichmentType - Type of enrichments to apply to generated operations
 * @param config - Configuration defining the operation generation behavior
 * @returns Constructor function for creating operation instances
 */
export const toGqlOperationBase = <EnrichmentType = undefined>(
  config: BaseGqlOperationConfig<EnrichmentType>
) => {
  return class extends GqlOperationBase<EnrichmentType> {
    static id = config.id
    static type = 'operation' as const

    static toIdentifier = config.toIdentifier.bind(config)
    static toExportPath = config.toExportPath.bind(config)

    static toEnrichments = ({ operation, context }: ToEnrichmentsArgs): EnrichmentType => {
      const operationEnrichments = get(
        context.settings,
        `enrichments.${config.id}.${operation.rootKind}.${operation.fieldName}`
      )

      const enrichmentSchema = config.toEnrichmentSchema?.() ?? v.optional(v.unknown())

      return v.parse(enrichmentSchema, operationEnrichments) as EnrichmentType
    }

    constructor(args: GqlOperationInsertableArgs<EnrichmentType>) {
      super({
        ...args,
        generatorKey: toGqlOperationGeneratorKey({
          generatorId: config.id,
          operation: args.operation
        })
      })
    }
  }
}
