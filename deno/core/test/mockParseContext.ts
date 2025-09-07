import type { LogSkippedValuesArgs, ProvisionalParseArgs } from '../context/ParseContext.ts'

/**
 * Mock implementation of ParseContext for testing purposes.
 * 
 * Provides simplified implementations of ParseContext methods that
 * can be used in unit tests without requiring a full parse context
 * setup. Methods perform minimal operations to enable testing of
 * parsing logic without side effects.
 * 
 * @example Usage in tests
 * ```typescript
 * import { mockParseContext } from '@skmtc/core/test';
 * 
 * const result = someParsingFunction({
 *   context: mockParseContext,
 *   value: testValue
 * });
 * 
 * // Test the result without worrying about logging or tracing
 * expect(result).toEqual(expectedValue);
 * ```
 */
export const mockParseContext = {
  trace<T>(token: string | string[], fn: () => T): T {
    return fn()
  },

  provisionalParse<T>(args: ProvisionalParseArgs<T>): T {
    return args.value as T
  },

  logSkippedFields({ skipped, parent, parentType }: LogSkippedValuesArgs): void {
    Object.entries(skipped).forEach(([_key, _value]) => {
      // console.log(`Skipped field: ${key}, value: ${value}`)
    })
  },

  logIssue(): void {
    //do nothing
  }
}
