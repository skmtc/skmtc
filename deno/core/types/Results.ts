/**
 * @fileoverview Results and Status Tracking System for SKMTC Core
 * 
 * This module provides comprehensive result tracking and status management for
 * the SKMTC code generation pipeline. It includes hierarchical result structures,
 * type-safe status definitions, and validation schemas for tracking the outcomes
 * of parsing, generation, and rendering operations.
 * 
 * The results system enables detailed reporting and error handling throughout
 * the pipeline, supporting nested result structures for complex operations
 * and comprehensive status categorization.
 * 
 * ## Key Features
 * 
 * - **Hierarchical Results**: Nested result structures for complex operations
 * - **Status Categories**: Complete coverage of operation outcomes (success, warning, error, etc.)
 * - **Type Safety**: Full TypeScript typing with Valibot validation
 * - **Recursive Support**: Lazy evaluation for deeply nested result structures
 * - **Pipeline Integration**: Direct integration with SKMTC processing contexts
 * 
 * @example Basic result tracking
 * ```typescript
 * import type { ResultType, ResultsItem } from '@skmtc/core/Results';
 * 
 * const operationResult: ResultType = 'success';
 * const errorResult: ResultType = 'error';
 * 
 * const results: ResultsItem = {
 *   parsing: 'success',
 *   generation: 'warning',
 *   rendering: 'success'
 * };
 * ```
 * 
 * @example Hierarchical result structures
 * ```typescript
 * import type { ResultsItem } from '@skmtc/core/Results';
 * 
 * const complexResults: ResultsItem = {
 *   parsing: {
 *     schemas: 'success',
 *     operations: {
 *       userApi: 'success',
 *       productApi: 'warning',
 *       orderApi: 'error'
 *     }
 *   },
 *   generation: [
 *     { models: 'success' },
 *     { services: 'warning' },
 *     null // Skipped operation
 *   ]
 * };
 * ```
 * 
 * @example Result validation
 * ```typescript
 * import { resultsItem, resultType, ResultsItem } from '@skmtc/core/Results';
 * import * as v from 'valibot';
 * 
 * function validateResults(data: unknown): ResultsItem {
 *   return v.parse(resultsItem, data);
 * }
 * 
 * function validateResultType(status: unknown): ResultType {
 *   return v.parse(resultType, status);
 * }
 * 
 * // Usage
 * const results = validateResults({
 *   operation: 'success',
 *   nested: {
 *     subOperation: 'warning'
 *   }
 * });
 * ```
 * 
 * @example Error filtering
 * ```typescript
 * import type { ResultType, WarningError } from '@skmtc/core/Results';
 * 
 * function hasIssues(result: ResultType): result is WarningError {
 *   return result === 'warning' || result === 'error';
 * }
 * 
 * function processResults(results: Record<string, ResultType>) {
 *   const issues = Object.entries(results)
 *     .filter(([, status]) => hasIssues(status));
 *   
 *   if (issues.length > 0) {
 *     console.log('Operations with issues:', issues);
 *   }
 * }
 * ```
 * 
 * @module Results
 */

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
