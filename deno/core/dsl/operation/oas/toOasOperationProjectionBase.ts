import { toOasOperationGeneratorKey } from '@/dsl/GeneratorKeys.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import type { OasOperation } from '@/oas/operation/Operation.ts'
import { OasOperationProjectionBase } from '@/dsl/operation/oas/OasOperationProjectionBase.ts'
import type { Identifier } from '@/dsl/Identifier.ts'
import type {
  OasOperationProjectionConstructorArgs,
  ToOasOperationIdentifierArgs,
  ToOasOperationExportPathArgs
} from '@/dsl/operation/oas/types.ts'
import * as v from 'valibot'
// @deno-types="npm:@types/lodash-es@4.17.12/get.d.ts"
import get from 'lodash-es/get'
import { DEFAULT_VARIANT } from '@/types/Variant.ts'

/**
 * Configuration for {@link toOasOperationProjectionBase}.
 */
export type OasOperationProjectionBaseConfig<EnrichmentType = undefined> = {
  id: string
  toIdentifier: (args: ToOasOperationIdentifierArgs<EnrichmentType>) => Identifier
  toExportPath: (args: ToOasOperationExportPathArgs<EnrichmentType>) => string
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
  /** Operation variant whose enrichment should be resolved (see {@link Variant}) */
  variant: string
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

    static toEnrichments = ({
      operation,
      context,
      variant
    }: ToEnrichmentsArgs): EnrichmentType => {
      // The variant axis is owned by core: consumer enrichments are keyed
      // `[generatorId][path][method][variant]`, and the generator's own
      // schema describes the per-variant inner value. The engine has
      // already enumerated valid variants and asserted `'main'` exists,
      // so the lookup here either hits a declared variant or — for the
      // synthetic single-`'main'` pass when no enrichments are
      // configured — returns `undefined`, which the Valibot schema
      // accepts via its `v.optional(...)` envelope.
      const operationEnrichments = get(
        context.settings,
        `enrichments.${config.id}.${operation.path}.${operation.method}.${variant}`
      )

      const enrichmentSchema = config.toEnrichmentSchema?.() ?? v.optional(v.unknown())

      return v.parse(enrichmentSchema, operationEnrichments) as EnrichmentType
    }

    constructor(args: OasOperationProjectionConstructorArgs<EnrichmentType>) {
      super({
        ...args,
        generatorKey: toOasOperationGeneratorKey({
          generatorId: config.id,
          operation: args.operation,
          variant: args.settings.variant ?? DEFAULT_VARIANT
        })
      })
    }
  }
}
