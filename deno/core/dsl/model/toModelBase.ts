import type { GenerateContext } from '../../context/GenerateContext.ts'
import { toModelGeneratorKey } from '../../types/GeneratorKeys.ts'
import type { RefName } from '../../types/RefName.ts'
import type { ContentSettings } from '../ContentSettings.ts'
import { ModelBase } from './ModelBase.ts'
import type { Identifier } from '../Identifier.ts'
import * as v from 'valibot'
// @deno-types="npm:@types/lodash-es@4.17.12"
import { get } from 'npm:lodash-es@4.17.21'

export type ModelInsertableArgs<EnrichmentType = undefined> = {
  context: GenerateContext
  settings: ContentSettings<EnrichmentType>
  refName: RefName
}

type ToEnrichmentsArgs = {
  refName: RefName
  context: GenerateContext
}

export type BaseModelConfig<EnrichmentType = undefined> = {
  id: string
  toIdentifier: (refName: RefName) => Identifier
  toExportPath: (refName: RefName) => string
  toEnrichmentSchema?: () => v.BaseSchema<EnrichmentType, EnrichmentType, v.BaseIssue<unknown>>
}

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
