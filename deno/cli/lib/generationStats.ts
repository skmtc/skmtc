import type { ManifestContent } from '@skmtc/core/Manifest'
import type { ResultsItem, ResultType } from '@skmtc/core/Results'

/**
 * Arguments for generating comprehensive statistics from the build manifest and artifacts.
 */
type GenerationStatsArgs = {
  /** The generation manifest containing build metadata and results */
  manifest: ManifestContent
  /** Generated artifacts as a map of file paths to content */
  artifacts: Record<string, string>
  /** Count the GPT tokens of the artifacts (`generate --count-tokens`). */
  countTokens?: boolean
}

/**
 * Comprehensive generation statistics extracted from build artifacts and manifest.
 */
export type GenerationStats = {
  /** Total number of GPT tokens in generated content. Present only when counted. */
  tokens?: number
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
 * Summarizes a generation run: lines, time, error paths and file count from
 * the manifest and artifacts. The GPT token count is made, and `tokens` set,
 * only when `countTokens` is `true`.
 *
 * @example
 * ```typescript
 * const stats = await toGenerationStats({ manifest, artifacts })
 * // { lines: 230, totalTime: 45000, errors: [], files: 2 }
 *
 * const counted = await toGenerationStats({ manifest, artifacts, countTokens: true })
 * // { tokens: 250, lines: 230, totalTime: 45000, errors: [], files: 2 }
 * ```
 */
export const toGenerationStats = async ({
  manifest,
  artifacts,
  countTokens = false
}: GenerationStatsArgs): Promise<GenerationStats> => {
  const lines = toManifestLines(manifest)
  const totalTime = toTotalTime(manifest)
  const errors = toManifestErrors(manifest.results)
  const files = Object.keys(artifacts).length

  return {
    ...(countTokens ? { tokens: await toManifestTokens(artifacts) } : {}),
    lines,
    totalTime,
    errors,
    files
  }
}

/**
 * Counts the GPT tokens of all generated artifacts.
 *
 * `gpt-tokenizer` is imported here, not at module scope: loading it costs
 * about 70 ms, and a run pays for it only when the count is asked for.
 *
 * @param artifacts - Map of file paths to generated content strings
 * @returns Total number of GPT tokens across all artifacts
 */
export const toManifestTokens = async (artifacts: Record<string, string>): Promise<number> => {
  const { countTokens } = await import('gpt-tokenizer')

  return Object.values(artifacts).reduce((total, artifact) => total + countTokens(artifact), 0)
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
  result: ResultsItem | (ResultsItem | null)[] | ResultType | null
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
  if (Array.isArray(result)) {
    result.forEach(item => {
      if (item !== null) {
        checkResult({ path, result: item, errors })
      }
    })
  } else if (typeof result === 'string') {
    if (result === 'error') {
      errors.push(path)
    }
  } else if (result == null) {
    checkResult({ path, result, errors })
  } else {
    if (typeof result === 'object') {
      Object.entries(result).forEach(([key, value]) => {
        checkResult({ path: [...path, key], result: value, errors })
      })
    } else {
      throw new Error('Invalid result type')
    }
  }
}
