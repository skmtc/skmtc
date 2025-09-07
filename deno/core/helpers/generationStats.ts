import type { ManifestContent } from '../types/Manifest.ts'
import type { ResultsItem, ResultType } from '../types/Results.ts'
import { match, P } from 'ts-pattern'
import { countTokens } from 'gpt-tokenizer'

/**
 * Arguments for generating comprehensive statistics from the build manifest and artifacts.
 */
type GenerationStatsArgs = {
  /** The generation manifest containing build metadata and results */
  manifest: ManifestContent
  /** Generated artifacts as a map of file paths to content */
  artifacts: Record<string, string>
}

/**
 * Comprehensive generation statistics extracted from build artifacts and manifest.
 */
export type GenerationStats = {
  /** Total number of GPT tokens in generated content */
  tokens: number
  /** Total number of lines generated */
  lines: number
  /** Total generation time in milliseconds */
  totalTime: number
  /** Error paths organized as nested arrays */
  errors: string[][]
  /** Total number of generated files */
  files: number
}

/**
 * Generates comprehensive statistics about the code generation process.
 * 
 * This function analyzes the generation manifest and produced artifacts to create
 * detailed statistics including token counts, lines of code, timing information,
 * error tracking, and file counts. It's used for performance monitoring, debugging,
 * and reporting on generation runs.
 * 
 * The function combines multiple analysis methods to provide a complete picture
 * of the generation process, including tokenization analysis for cost estimation,
 * error path extraction for debugging, and timing analysis for performance optimization.
 * 
 * @param args - Generation analysis configuration
 * @param args.manifest - The generation manifest with metadata and results
 * @param args.artifacts - Map of file paths to generated content
 * @returns Comprehensive generation statistics object
 * 
 * @example Basic usage
 * ```typescript
 * import { toGenerationStats } from '@skmtc/core';
 * 
 * const stats = toGenerationStats({
 *   manifest: {
 *     startAt: 1672531200000,
 *     endAt: 1672531245000,
 *     files: {
 *       './models.ts': { lines: 150, characters: 4500 },
 *       './types.ts': { lines: 80, characters: 2100 }
 *     },
 *     results: { }
 *   },
 *   artifacts: {
 *     './models.ts': 'export interface User { id: string; name: string; }',
 *     './types.ts': 'export type Status = "active" | "inactive";'
 *   }
 * });
 * 
 * console.log(stats);
 * // {
 * //   tokens: 250,
 * //   lines: 230,
 * //   totalTime: 45000,
 * //   errors: [],
 * //   files: 2
 * // }
 * ```
 * 
 * @example Performance monitoring
 * ```typescript
 * class GenerationMonitor {
 *   analyzeGeneration(manifest: ManifestContent, artifacts: Record<string, string>) {
 *     const stats = toGenerationStats({ manifest, artifacts });
 *     
 *     console.log(`Generation completed in ${stats.totalTime}ms`);
 *     console.log(`Generated ${stats.files} files with ${stats.lines} lines`);
 *     console.log(`Token usage: ${stats.tokens} tokens`);
 *     
 *     if (stats.errors.length > 0) {
 *       console.warn(`Found ${stats.errors.length} errors:`);
 *       stats.errors.forEach((errorPath, index) => {
 *         console.warn(`  ${index + 1}. ${errorPath.join(' -> ')}`);
 *       });
 *     }
 *     
 *     return stats;
 *   }
 * }
 * ```
 * 
 * @example Cost estimation
 * ```typescript
 * function estimateGenerationCost(stats: GenerationStats): number {
 *   const tokensPerDollar = 1000000; // Example rate
 *   const estimatedCost = stats.tokens / tokensPerDollar;
 *   
 *   console.log(`Estimated cost: $${estimatedCost.toFixed(4)}`);
 *   console.log(`Efficiency: ${stats.lines / stats.tokens} lines per token`);
 *   
 *   return estimatedCost;
 * }
 * ```
 * 
 * @example Build reporting
 * ```typescript
 * function generateBuildReport(stats: GenerationStats): string {
 *   const efficiency = stats.totalTime / stats.files;
 *   const successRate = ((stats.files - stats.errors.length) / stats.files * 100).toFixed(1);
 *   
 *   return `
 * Build Report:
 * -----------
 * Files Generated: ${stats.files}
 * Total Lines: ${stats.lines.toLocaleString()}
 * Token Count: ${stats.tokens.toLocaleString()}
 * Generation Time: ${(stats.totalTime / 1000).toFixed(2)}s
 * Average per File: ${efficiency.toFixed(0)}ms
 * Success Rate: ${successRate}%
 * Errors: ${stats.errors.length}
 *   `.trim();
 * }
 * ```
 */
export const toGenerationStats = ({ manifest, artifacts }: GenerationStatsArgs): GenerationStats => {
  const tokens = toManifestTokens(artifacts)
  const lines = toManifestLines(manifest)
  const totalTime = toTotalTime(manifest)
  const errors = toManifestErrors(manifest.results)
  const files = Object.keys(artifacts).length

  return {
    tokens,
    lines,
    totalTime,
    errors,
    files
  }
}

/**
 * Calculates the total number of GPT tokens in all generated artifacts.
 * 
 * This function uses GPT tokenization to count the total number of tokens
 * across all generated code artifacts. This is useful for cost estimation
 * when using token-based pricing models and for understanding the size
 * and complexity of generated content.
 * 
 * @param artifacts - Map of file paths to generated content strings
 * @returns Total number of GPT tokens across all artifacts
 * 
 * @example
 * ```typescript
 * const artifacts = {
 *   './models.ts': 'export interface User { id: string; name: string; }',
 *   './types.ts': 'export type Status = "active" | "inactive";'
 * };
 * 
 * const tokens = toManifestTokens(artifacts);
 * console.log(tokens); // e.g., 24 tokens
 * ```
 */
export const toManifestTokens = (artifacts: Record<string, string>): number => {
  const { tokens } = Object.values(artifacts).reduce(
    (acc, artifact) => ({ tokens: acc.tokens + countTokens(artifact) }),
    { tokens: 0 }
  )

  return tokens
}

/**
 * Calculates the total number of lines across all generated files.
 * 
 * This function sums up the line counts from the manifest's file metadata
 * to provide the total lines of code generated. This metric is useful
 * for understanding the scale of code generation and tracking productivity.
 * 
 * @param manifest - The generation manifest containing file metadata
 * @returns Total number of lines across all generated files
 * 
 * @example
 * ```typescript
 * const manifest = {
 *   files: {
 *     './models.ts': { lines: 150, characters: 4500 },
 *     './types.ts': { lines: 80, characters: 2100 }
 *   },
 *   // ... other manifest properties
 * };
 * 
 * const lines = toManifestLines(manifest);
 * console.log(lines); // 230
 * ```
 */
export const toManifestLines = (manifest: ManifestContent): number => {
  const { lines } = Object.values(manifest.files).reduce(
    (acc, file) => ({ lines: acc.lines + file.lines }),
    { lines: 0 }
  )

  return lines
}

/**
 * Calculates the total generation time from the manifest timestamps.
 * 
 * This function computes the duration of the generation process by
 * calculating the difference between the end and start timestamps
 * recorded in the manifest. The result is in milliseconds.
 * 
 * @param manifest - The generation manifest with timing information
 * @returns Total generation time in milliseconds
 * 
 * @example
 * ```typescript
 * const manifest = {
 *   startAt: 1672531200000, // January 1, 2023 00:00:00 GMT
 *   endAt: 1672531245000,   // January 1, 2023 00:00:45 GMT
 *   // ... other manifest properties
 * };
 * 
 * const duration = toTotalTime(manifest);
 * console.log(duration); // 45000 (45 seconds)
 * console.log(`${duration / 1000}s`); // "45s"
 * ```
 */
export const toTotalTime = (manifest: ManifestContent): number => {
  const totalTime = manifest.endAt - manifest.startAt

  return totalTime
}

/**
 * Extracts and organizes error paths from the manifest results.
 * 
 * This function recursively traverses the results structure in the manifest
 * to identify all error conditions and their associated file paths. Errors
 * are returned as arrays of path segments, making it easy to understand
 * the location and context of each error.
 * 
 * @param results - The results object from the generation manifest
 * @returns Array of error paths, each represented as an array of path segments
 * 
 * @example
 * ```typescript
 * const results = {
 *   'models.ts': {
 *     'User': 'success',
 *     'Product': 'error'
 *   },
 *   'types.ts': 'success'
 * };
 * 
 * const errors = toManifestErrors(results);
 * console.log(errors); // [['models.ts', 'Product']]
 * 
 * // Display errors in readable format
 * errors.forEach(errorPath => {
 *   console.log(`Error at: ${errorPath.join(' -> ')}`);
 * });
 * // Output: "Error at: models.ts -> Product"
 * ```
 */
export const toManifestErrors = (results: ManifestContent['results']): string[][] => {
  const errors: string[][] = []

  Object.entries(results).map(([path, result]) => {
    return checkResult({ path: [path], result, errors })
  })

  return errors
}

/**
 * Arguments for recursively checking results for error conditions.
 */
type CheckResultArgs = {
  /** Current path segments being traversed */
  path: string[]
  /** The result value to check (can be nested) */
  result: ResultsItem | (ResultsItem | null)[] | ResultType
  /** Array to accumulate error paths (mutated) */
  errors: string[][]
}

/**
 * Recursively checks results structure for error conditions and collects error paths.
 * 
 * This function traverses the complex nested structure of generation results,
 * identifying error conditions at any level and recording their full path context.
 * It handles arrays, objects, strings, and null values, building a comprehensive
 * map of all errors that occurred during generation.
 * 
 * The function mutates the errors array parameter, accumulating error paths
 * as it traverses the results structure. This approach is used for performance
 * when processing large result sets.
 * 
 * @param args - Arguments for result checking
 * @param args.path - Current path segments being traversed
 * @param args.result - The result value to check for errors
 * @param args.errors - Array to accumulate error paths (mutated by function)
 * 
 * @example Simple error detection
 * ```typescript
 * const errors: string[][] = [];
 * 
 * checkResult({
 *   path: ['models.ts'],
 *   result: 'error',
 *   errors
 * });
 * 
 * console.log(errors); // [['models.ts']]
 * ```
 * 
 * @example Nested structure error detection
 * ```typescript
 * const errors: string[][] = [];
 * const nestedResult = {
 *   'User': 'success',
 *   'Product': {
 *     'validation': 'error',
 *     'generation': 'success'
 *   }
 * };
 * 
 * checkResult({
 *   path: ['models.ts'],
 *   result: nestedResult,
 *   errors
 * });
 * 
 * console.log(errors); // [['models.ts', 'Product', 'validation']]
 * ```
 * 
 * @example Array handling
 * ```typescript
 * const errors: string[][] = [];
 * const arrayResult = ['success', null, 'error', 'success'];
 * 
 * checkResult({
 *   path: ['batch'],
 *   result: arrayResult,
 *   errors
 * });
 * 
 * console.log(errors); // [['batch']] - for the 'error' item
 * ```
 */
export const checkResult = ({ path, result, errors }: CheckResultArgs): void => {
  match(result)
    .with(P.array(), matchedResult => {
      return matchedResult.map(item => {
        if (item !== null) {
          checkResult({ path, result: item, errors })
        }
      })
    })
    .with(P.string, matchedResult => {
      if (matchedResult === 'error') {
        errors.push(path)
      }
    })
    .with(P.nullish, matchedResult => {
      return checkResult({ path, result: matchedResult, errors })
    })
    .otherwise(matched => {
      if (typeof matched === 'object') {
        return Object.entries(matched).map(([key, value]) => {
          return checkResult({ path: [...path, key], result: value, errors })
        })
      } else {
        throw new Error('Invalid result type')
      }
    })
}
