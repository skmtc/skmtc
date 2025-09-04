import * as v from 'valibot'

export type ResultType = 'success' | 'warning' | 'error' | 'skipped' | 'notSupported'

export type WarningError = 'warning' | 'error'

export const resultType = v.union([
  v.literal('success'),
  v.literal('warning'),
  v.literal('error'),
  v.literal('skipped'),
  v.literal('notSupported')
])

export interface ResultsItem {
  [key: string]: ResultType | ResultsItem | Array<ResultsItem | null>
}

export const resultsItem: v.GenericSchema<ResultsItem> = v.record(
  v.string(),
  v.lazy(() => v.union([resultsItem, resultType, v.array(v.lazy(() => resultsItem))]))
)
