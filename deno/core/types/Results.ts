import * as v from 'valibot'

/**
 * Type representing the possible outcomes of SKMTC processing operations.
 * 
 * Used throughout the SKMTC pipeline to track and categorize the results
 * of parsing, generation, and rendering operations.
 */
export type ResultType = 'success' | 'warning' | 'error' | 'skipped' | 'notSupported'

/**
 * Type representing result types that indicate issues or problems.
 * 
 * Used for filtering and handling results that require attention,
 * excluding successful, skipped, or unsupported operations.
 */
export type WarningError = 'warning' | 'error'

/**
 * Valibot schema for validating ResultType values.
 * 
 * Used for runtime validation of result type values throughout
 * the SKMTC pipeline to ensure type safety and data integrity.
 */
export const resultType: v.GenericSchema<ResultType> = v.union([
  v.literal('success'),
  v.literal('warning'),
  v.literal('error'),
  v.literal('skipped'),
  v.literal('notSupported')
])

/**
 * Interface representing a hierarchical results structure.
 * 
 * Allows for nested result tracking where each key can contain
 * a result type, another results item (for nesting), or an array
 * of results items for collections.
 */
export interface ResultsItem {
  /** Dynamic key-value pairs for hierarchical result tracking */
  [key: string]: ResultType | ResultsItem | Array<ResultsItem | null>
}

/**
 * Valibot schema for validating ResultsItem structures.
 * 
 * Uses lazy evaluation to handle recursive result item validation,
 * supporting nested hierarchical result structures.
 */
export const resultsItem: v.GenericSchema<ResultsItem> = v.record(
  v.string(),
  v.lazy(() => v.union([resultsItem, resultType, v.array(v.lazy(() => resultsItem))]))
)
