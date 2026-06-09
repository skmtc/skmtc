import type { GenerateContextType } from '@/context/generateTypes.ts'
import type { GqlOperation } from '@/gql/operation/GqlOperation.ts'
import { GqlOperationProjectionBase } from './GqlOperationProjectionBase.ts'
import type { Identifier } from '@/dsl/Identifier.ts'
import type { Lang } from '@/dsl/Lang.ts'
import type {
  GqlOperationProjectionConstructorArgs,
  ToGqlOperationIdentifierArgs,
  ToGqlOperationExportPathArgs
} from './types.ts'
import { toGqlOperationGeneratorKey } from '@/dsl/GeneratorKeys.ts'
import * as v from 'valibot'
// @deno-types="npm:@types/lodash-es@4.17.12/get.d.ts"
import get from 'lodash-es/get'
import { DEFAULT_VARIANT } from '@/types/Variant.ts'

/**
 * Configuration for {@link toGqlOperationProjectionBase}.
 */
export type GqlOperationProjectionBaseConfig<EnrichmentType = undefined> = {
  id: string
  /** The target language — a `@skmtc/lang-*` `Lang`. Exposed as `static lang` + injected as instance `lang`. */
  lang: Lang
  toIdentifier: (args: ToGqlOperationIdentifierArgs<EnrichmentType>) => Identifier
  toExportPath: (args: ToGqlOperationExportPathArgs<EnrichmentType>) => string
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
  /** Operation variant whose enrichment should be resolved (see {@link Variant}) */
  variant: string
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
    static lang: Lang = config.lang

    static toIdentifier = config.toIdentifier.bind(config)
    static toExportPath = config.toExportPath.bind(config)

    static isSupported = config.isSupported ?? (() => true)

    static toEnrichments = ({
      operation,
      context,
      variant
    }: ToEnrichmentsArgs): EnrichmentType => {
      // Same shape as the OAS branch — see the comment there for the
      // full rationale. GraphQL routing key is
      // `[generatorId][rootKind][fieldName][variant]`.
      const operationEnrichments = get(
        context.settings,
        `enrichments.${config.id}.${operation.rootKind}.${operation.fieldName}.${variant}`
      )

      const enrichmentSchema = config.toEnrichmentSchema?.() ?? v.optional(v.unknown())

      return v.parse(enrichmentSchema, operationEnrichments) as EnrichmentType
    }

    constructor(args: GqlOperationProjectionConstructorArgs<EnrichmentType>) {
      super({
        ...args,
        lang: config.lang,
        generatorKey: toGqlOperationGeneratorKey({
          generatorId: config.id,
          operation: args.operation,
          variant: args.settings.variant ?? DEFAULT_VARIANT
        })
      })
    }
  }
}
