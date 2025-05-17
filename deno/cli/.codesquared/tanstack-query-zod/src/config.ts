import { TanstackQuery } from './TanstackQuery.ts'
import * as v from 'valibot'
import { toOperationConfig } from '@skmtc/core'

export type EnrichmentSchema = undefined

export const tanstackQueryConfig = toOperationConfig<undefined>({
  id: '@skmtc/tanstack-query',
  transform: ({ context, operation }) => {
    context.insertOperation({ insertable: TanstackQuery, operation })
  },
  toEnrichmentSchema: () => v.undefined(),
  isSupported: () => true
})
