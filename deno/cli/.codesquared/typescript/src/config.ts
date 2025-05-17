import { toModelConfig } from '@skmtc/core'
import { TsInsertable } from "./TsInsertable.ts";
import { toEnrichmentSchema, type EnrichmentSchema } from './enrichments.ts'

export const typescriptConfig = toModelConfig<EnrichmentSchema>({
  id: '@skmtc/typescript',
  toEnrichmentSchema,
  transform({ context, refName }) {
    context.insertModel({insertable: TsInsertable, refName, rootRef: refName})
  }
})
