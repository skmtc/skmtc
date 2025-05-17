import { toEnrichmentSchema, type EnrichmentSchema } from './enrichments.ts'
import { toModelConfig } from '@skmtc/core'
import { ZodInsertable } from './ZodInsertable.ts'

export const zodConfig = toModelConfig<EnrichmentSchema>({
  id: '@skmtc/zod',
  toEnrichmentSchema: toEnrichmentSchema,
  transform({ context, refName }) {
    context.insertModel({insertable: ZodInsertable, refName, rootRef: refName})
  }
})
  