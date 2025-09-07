// @deno-types="npm:@types/lodash-es@4.17.12"
import { set } from 'npm:lodash-es@4.17.21'
import type { ResultsItem, ResultType } from '../types/Results.ts'

/**
 * Manages and organizes generation results with intelligent prioritization.
 * 
 * `ResultsLog` tracks the outcomes of code generation operations, maintaining
 * a hierarchical structure of results organized by stack trail paths. It implements
 * intelligent result prioritization, ensuring that more severe results (errors)
 * take precedence over less severe ones (success, warnings) when multiple results
 * exist for the same path.
 * 
 * The class is designed to work with the SKMTC tracing system, using stack trail
 * identifiers to organize results in a meaningful hierarchical structure that
 * reflects the execution flow of the generation process.
 * 
 * ## Key Features
 * 
 * - **Result Prioritization**: Automatically prioritizes more severe results
 * - **Hierarchical Organization**: Organizes results by stack trail paths
 * - **Tree Structure**: Converts flat result logs into nested tree structures
 * - **Duplicate Handling**: Prevents less severe results from overwriting more severe ones
 * 
 * @example Basic usage
 * ```typescript
 * import { ResultsLog } from '@skmtc/core';
 * 
 * const resultsLog = new ResultsLog();
 * 
 * // Capture results from different parts of generation
 * resultsLog.capture('models:User', 'success');
 * resultsLog.capture('models:Product', 'error');
 * resultsLog.capture('types:Status', 'success');
 * 
 * // Convert to hierarchical structure
 * const tree = resultsLog.toTree();
 * console.log(tree);
 * // {
 * //   models: {
 * //     User: 'success',
 * //     Product: 'error'
 * //   },
 * //   types: {
 * //     Status: 'success'
 * //   }
 * // }
 * ```
 * 
 * @example Result prioritization
 * ```typescript
 * const resultsLog = new ResultsLog();
 * 
 * // First capture a success
 * resultsLog.capture('api:createUser', 'success');
 * 
 * // Later encounter an error at the same path
 * resultsLog.capture('api:createUser', 'error');
 * 
 * // Error takes precedence
 * const tree = resultsLog.toTree();
 * console.log(tree.api.createUser); // 'error'
 * 
 * // But success won't overwrite error
 * resultsLog.capture('api:createUser', 'success');
 * console.log(resultsLog.toTree().api.createUser); // Still 'error'
 * ```
 * 
 * @example Complex nested paths
 * ```typescript
 * const resultsLog = new ResultsLog();
 * 
 * resultsLog.capture('generation:models:User:properties:name', 'success');
 * resultsLog.capture('generation:models:User:properties:email', 'warning');
 * resultsLog.capture('generation:models:Product:validation', 'error');
 * resultsLog.capture('generation:operations:createUser', 'success');
 * 
 * const tree = resultsLog.toTree();
 * console.log(tree);
 * // {
 * //   generation: {
 * //     models: {
 * //       User: {
 * //         properties: {
 * //           name: 'success',
 * //           email: 'warning'
 * //         }
 * //       },
 * //       Product: {
 * //         validation: 'error'
 * //       }
 * //     },
 * //     operations: {
 * //       createUser: 'success'
 * //     }
 * //   }
 * // }
 * ```
 * 
 * @example Integration with tracing
 * ```typescript
 * class TrackedGenerator {
 *   private resultsLog = new ResultsLog();
 *   
 *   generateModel(name: string, schema: OasSchema) {
 *     const stackPath = `models:${name}`;
 *     
 *     try {
 *       const model = this.processSchema(schema);
 *       this.resultsLog.capture(stackPath, 'success');
 *       return model;
 *     } catch (error) {
 *       this.resultsLog.capture(stackPath, 'error');
 *       throw error;
 *     }
 *   }
 *   
 *   generateOperation(operationId: string, operation: OasOperation) {
 *     const stackPath = `operations:${operationId}`;
 *     
 *     if (!this.supportsOperation(operation)) {
 *       this.resultsLog.capture(stackPath, 'notSupported');
 *       return null;
 *     }
 *     
 *     const result = this.processOperation(operation);
 *     this.resultsLog.capture(stackPath, 'success');
 *     return result;
 *   }
 *   
 *   getResults(): ResultsItem {
 *     return this.resultsLog.toTree();
 *   }
 * }
 * ```
 */
export class ResultsLog {
  #results: Record<string, ResultType>

  /**
   * Creates a new ResultsLog instance.
   * 
   * Initializes an empty results tracking system ready to capture
   * generation outcomes from various parts of the pipeline.
   */
  constructor() {
    this.#results = {}
  }

  /**
   * Captures a generation result for a specific stack trail path.
   * 
   * This method records the outcome of a generation operation, using intelligent
   * prioritization to ensure that more severe results take precedence over less
   * severe ones. For example, an error result will not be overwritten by a
   * success result, but a success can be overwritten by an error.
   * 
   * @param stackTrail - Colon-separated path identifying the operation location
   * @param result - The result type to capture (error, warning, success, etc.)
   * 
   * @example
   * ```typescript
   * const resultsLog = new ResultsLog();
   * 
   * // Capture various results
   * resultsLog.capture('models:User:properties:email', 'success');
   * resultsLog.capture('models:User:validation', 'warning');
   * resultsLog.capture('operations:createUser', 'error');
   * ```
   */
  capture(stackTrail: string, result: ResultType) {
    if (this.#incomingResultIsWorse(this.#results[stackTrail], result)) {
      this.#results[stackTrail] = result
    }
  }

  /**
   * Determines if an incoming result should replace the current result.
   * 
   * This private method implements the result prioritization logic by comparing
   * the severity rankings of results. Higher-ranked (more severe) results take
   * precedence over lower-ranked ones.
   * 
   * @param current - The current result at this path (may be undefined)
   * @param incoming - The new result being captured
   * @returns True if the incoming result should replace the current one
   * 
   * @example Severity ranking (high to low)
   * ```
   * error (50) > warning (40) > success (30) > skipped (20) > notSupported (10)
   * ```
   */
  #incomingResultIsWorse(current: ResultType | undefined, incoming: ResultType): boolean {
    if (current === undefined) {
      return true
    }

    return resultRankings[current] < resultRankings[incoming]
  }

  /**
   * Converts the flat results structure into a hierarchical tree.
   * 
   * This method transforms the internal flat storage (using colon-separated paths)
   * into a nested object structure that reflects the hierarchy of generation
   * operations. This makes it easier to understand and process results in
   * a structured way.
   * 
   * @returns Nested object structure representing the results hierarchy
   * 
   * @example
   * ```typescript
   * const resultsLog = new ResultsLog();
   * resultsLog.capture('api:models:User', 'success');
   * resultsLog.capture('api:operations:getUser', 'error');
   * resultsLog.capture('types:Status', 'success');
   * 
   * const tree = resultsLog.toTree();
   * console.log(tree);
   * // {
   * //   api: {
   * //     models: {
   * //       User: 'success'
   * //     },
   * //     operations: {
   * //       getUser: 'error'
   * //     }
   * //   },
   * //   types: {
   * //     Status: 'success'
   * //   }
   * // }
   * ```
   */
  toTree(): ResultsItem {
    const tree: ResultsItem = {}

    Object.entries(this.#results).forEach(([key, value]) => {
      const keys = key.split(':')

      set(tree, keys, value)
    })

    return tree
  }
}

/**
 * Priority rankings for different result types.
 * 
 * This mapping defines the severity hierarchy used by the ResultsLog to determine
 * which results should take precedence when multiple results are captured for the
 * same path. Higher numbers indicate higher severity/priority.
 * 
 * The ranking system ensures that critical issues (errors) are never masked by
 * less important results (success), while still allowing for proper escalation
 * when more severe conditions are encountered.
 * 
 * @example Ranking hierarchy (high to low priority)
 * ```
 * error (50)       - Critical failures that prevent generation
 * warning (40)     - Issues that allow generation but need attention  
 * success (30)     - Normal successful completion
 * skipped (20)     - Operations that were intentionally bypassed
 * notSupported (10) - Features not yet implemented
 * ```
 */
const resultRankings: Record<ResultType, number> = {
  error: 50,
  warning: 40,
  success: 30,
  skipped: 20,
  notSupported: 10
}
