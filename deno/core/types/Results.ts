import { z } from 'zod'

export type ResultType = 'success' | 'warning' | 'error' | 'notSelected' | 'notSupported'

export type WarningError = 'warning' | 'error'

export const resultType = z.enum(['success', 'warning', 'error', 'notSelected', 'notSupported'])

export interface ResultsItem {
  [key: string]: ResultType | ResultsItem | Array<ResultsItem | null>
}

export const resultsItem: z.ZodType<ResultsItem> = z.record(
  z.lazy(() => z.union([resultsItem, resultType, z.array(resultsItem.nullable())]))
)
