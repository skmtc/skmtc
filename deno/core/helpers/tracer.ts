import type { Logger } from '@std/log/logger'
import type { StackTrail } from '../context/StackTrail.ts'

/**
 * Executes a function with distributed tracing support and stack trail management.
 * 
 * This utility function provides distributed tracing capabilities for the SKMTC
 * generation pipeline. It manages stack trail tokens that help track execution
 * context across complex nested operations, making debugging and performance
 * analysis much easier.
 * 
 * The tracer ensures proper cleanup of stack trail tokens even if the wrapped
 * function throws an error, maintaining the integrity of the tracing system.
 * This is essential for accurate debugging and performance monitoring in
 * complex code generation scenarios.
 * 
 * @template T - The return type of the traced function
 * @param stackTrail - The stack trail instance for tracking execution context
 * @param token - Token(s) to identify this execution step in traces
 * @param fn - The function to execute with tracing
 * @param log - Logger instance for error reporting
 * @returns The result of the wrapped function execution
 * 
 * @throws Re-throws any error from the wrapped function after cleanup
 * 
 * @example Basic tracing usage
 * ```typescript
 * import { tracer } from '@skmtc/core';
 * 
 * class ModelGenerator {
 *   generateModel(stackTrail: StackTrail, logger: Logger) {
 *     return tracer(stackTrail, 'generate-model', () => {
 *       // Complex model generation logic here
 *       return this.createModelDefinition();
 *     }, logger);
 *   }
 * }
 * ```
 * 
 * @example Nested tracing
 * ```typescript
 * class ComplexProcessor {
 *   processSchema(stackTrail: StackTrail, logger: Logger) {
 *     return tracer(stackTrail, 'process-schema', () => {
 *       const parsed = tracer(stackTrail, 'parse', () => {
 *         return this.parseSchema();
 *       }, logger);
 *       
 *       const validated = tracer(stackTrail, 'validate', () => {
 *         return this.validateSchema(parsed);
 *       }, logger);
 *       
 *       return tracer(stackTrail, 'transform', () => {
 *         return this.transformSchema(validated);
 *       }, logger);
 *     }, logger);
 *   }
 * }
 * 
 * // Stack trail will show: ['process-schema', 'parse'] -> ['process-schema', 'validate'] -> ['process-schema', 'transform']
 * ```
 * 
 * @example Multiple token tracing
 * ```typescript
 * const result = tracer(
 *   stackTrail,
 *   ['file-generation', 'models.ts'], // Multiple tokens for detailed context
 *   () => {
 *     return generateModelsFile();
 *   },
 *   logger
 * );
 * ```
 * 
 * @example Error handling with tracing
 * ```typescript
 * class SafeGenerator {
 *   generateWithTracing(stackTrail: StackTrail, logger: Logger) {
 *     try {
 *       return tracer(stackTrail, 'risky-operation', () => {
 *         // This might throw an error
 *         return this.complexGeneration();
 *       }, logger);
 *     } catch (error) {
 *       // Stack trail is automatically cleaned up
 *       logger.error(`Generation failed: ${error.message}`);
 *       return this.fallbackGeneration();
 *     }
 *   }
 * }
 * ```
 * 
 * @example Performance monitoring
 * ```typescript
 * class PerformanceAwareGenerator {
 *   timedGeneration(stackTrail: StackTrail, logger: Logger) {
 *     const startTime = Date.now();
 *     
 *     const result = tracer(stackTrail, 'timed-generation', () => {
 *       return this.heavyComputation();
 *     }, logger);
 *     
 *     const duration = Date.now() - startTime;
 *     logger.info(`Generation completed in ${duration}ms`);
 *     
 *     return result;
 *   }
 * }
 * ```
 * 
 * @example Integration with context classes
 * ```typescript
 * // Typically used within context classes like this:
 * class GenerateContext {
 *   trace<T>(token: string | string[], fn: () => T): T {
 *     return tracer(this.stackTrail, token, fn, this.logger);
 *   }
 *   
 *   processModel(schema: OasSchema) {
 *     return this.trace(['model', schema.type], () => {
 *       // Model processing logic
 *       return this.createModel(schema);
 *     });
 *   }
 * }
 * ```
 */
export const tracer = <T>(
  stackTrail: StackTrail,
  token: string | string[],
  fn: () => T,
  _log: Logger
) => {
  stackTrail.append(token)
  try {
    const result = fn()

    stackTrail.remove(token)

    return result
  } catch (error) {
    // log.error(error)

    stackTrail.remove(token)

    throw error
  }
}
