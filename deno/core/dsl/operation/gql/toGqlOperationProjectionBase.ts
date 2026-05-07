import type { GenerateContextType } from '@/context/generateTypes.ts'
import type { GqlOperation } from '@/gql/operation/GqlOperation.ts'
import { GqlOperationProjectionBase } from './GqlOperationProjectionBase.ts'
import type { Identifier } from '@/dsl/Identifier.ts'
import type { GqlOperationProjectionConstructorArgs } from './types.ts'
import { toGqlOperationGeneratorKey } from '@/dsl/GeneratorKeys.ts'
import * as v from 'valibot'
// @deno-types="npm:@types/lodash-es@4.17.12/get.d.ts"
import get from 'lodash-es/get'

/**
 * Configuration for {@link toGqlOperationProjectionBase}.
 */
export type GqlOperationProjectionBaseConfig<EnrichmentType = undefined> = {
  id: string
  toIdentifier: (operation: GqlOperation) => Identifier
  toExportPath: (operation: GqlOperation) => string
  toEnrichmentSchema?: () => v.BaseSchema<EnrichmentType, EnrichmentType, v.BaseIssue<unknown>>
  /**
   * Family-level applicability predicate. Becomes a static `isSupported`
   * on the returned base class so other projections can probe it via the
   * operation-reference protocol. When omitted, advertises support for
   * every operation.
   */
  isSupported?: (args: { operation: GqlOperation; context: GenerateContextType }) => boolean
}

type ToEnrichmentsArgs = {
  operation: GqlOperation
  context: GenerateContextType
}

/**
 * Build a GraphQL operation projection base class from a per-generator
 * config.
 *
 * The returned class extends {@link GqlOperationProjectionBase}, exposes
 * the generator's `id`, `toIdentifier`, `toExportPath`, `toEnrichments`,
 * and `isSupported` statics, and injects `generatorKey` so subclasses
 * don't have to.
 */
export const toGqlOperationProjectionBase = <EnrichmentType = undefined>(
  config: GqlOperationProjectionBaseConfig<EnrichmentType>
) => {
  return class extends GqlOperationProjectionBase<EnrichmentType> {
    static id = config.id
    static type = 'gqlOperation' as const

    static toIdentifier = config.toIdentifier.bind(config)
    static toExportPath = config.toExportPath.bind(config)

    static isSupported = config.isSupported ?? (() => true)

    static toEnrichments = ({ operation, context }: ToEnrichmentsArgs): EnrichmentType => {
      const operationEnrichments = get(
        context.settings,
        `enrichments.${config.id}.${operation.rootKind}.${operation.fieldName}`
      )

      const enrichmentSchema = config.toEnrichmentSchema?.() ?? v.optional(v.unknown())

      return v.parse(enrichmentSchema, operationEnrichments) as EnrichmentType
    }

    constructor(args: GqlOperationProjectionConstructorArgs<EnrichmentType>) {
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
