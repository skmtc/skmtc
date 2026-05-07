import { toOasOperationGeneratorKey } from '@/dsl/GeneratorKeys.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import type { OasOperation } from '@/oas/operation/Operation.ts'
import { OasOperationProjectionBase } from '@/dsl/operation/oas/OasOperationProjectionBase.ts'
import type { Identifier } from '@/dsl/Identifier.ts'
import type { OasOperationProjectionConstructorArgs } from '@/dsl/operation/oas/types.ts'
import * as v from 'valibot'
// @deno-types="npm:@types/lodash-es@4.17.12/get.d.ts"
import get from 'lodash-es/get'

/**
 * Configuration for {@link toOasOperationProjectionBase}.
 */
export type OasOperationProjectionBaseConfig<EnrichmentType = undefined> = {
  id: string
  toIdentifier: (operation: OasOperation) => Identifier
  toExportPath: (operation: OasOperation) => string
  toEnrichmentSchema?: () => v.BaseSchema<EnrichmentType, EnrichmentType, v.BaseIssue<unknown>>
  /**
   * Family-level applicability predicate. Becomes a static `isSupported`
   * on the returned base class so other projections can probe it via the
   * operation-reference protocol. When omitted, advertises support for
   * every operation.
   */
  isSupported?: (args: { operation: OasOperation; context: GenerateContextType }) => boolean
}

type ToEnrichmentsArgs = {
  operation: OasOperation
  context: GenerateContextType
}

/**
 * Build an OAS operation projection base class from a per-generator config.
 *
 * The returned class extends {@link OasOperationProjectionBase}, exposes
 * the generator's `id`, `toIdentifier`, `toExportPath`, `toEnrichments`,
 * and `isSupported` statics, and injects `generatorKey` so subclasses
 * don't have to.
 */
export const toOasOperationProjectionBase = <EnrichmentType = undefined>(
  config: OasOperationProjectionBaseConfig<EnrichmentType>
) => {
  return class extends OasOperationProjectionBase<EnrichmentType> {
    static id = config.id
    static type = 'oasOperation' as const

    static toIdentifier = config.toIdentifier.bind(config)
    static toExportPath = config.toExportPath.bind(config)

    static isSupported = config.isSupported ?? (() => true)

    static toEnrichments = ({ operation, context }: ToEnrichmentsArgs): EnrichmentType => {
      const operationEnrichments = get(
        context.settings,
        `enrichments.${config.id}.${operation.path}.${operation.method}`
      )

      const enrichmentSchema = config.toEnrichmentSchema?.() ?? v.optional(v.unknown())

      return v.parse(enrichmentSchema, operationEnrichments) as EnrichmentType
    }

    constructor(args: OasOperationProjectionConstructorArgs<EnrichmentType>) {
      super({
        ...args,
        generatorKey: toOasOperationGeneratorKey({
          generatorId: config.id,
          operation: args.operation
        })
      })
    }
  }
}
