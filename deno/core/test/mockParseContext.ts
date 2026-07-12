import type { ParseContextType, LogSkippedValuesArgs } from '../context/parseTypes.ts'
import type { SkmtcParsedDocument } from '../types/SkmtcDocument.ts'
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
  trace<T>(_token: string | string[], fn: () => T): T {
    return fn()
  },

  logSkippedFields({
    skipped,
    parent: _parent,
    parentType: _parentType
  }: LogSkippedValuesArgs): void {
    Object.entries(skipped).forEach(([_key, _value]) => {
      // console.log(`Skipped field: ${key}, value: ${value}`)
    })
  },

  logIssue(): void {
    //do nothing
  },

  logIssueNoKey(): void {
    //do nothing
  },

  stackTrail: {
    append: () => {},
    remove: () => {},
    clone: () => ({ append: () => {}, remove: () => {}, clone: () => ({}) })
  },

  // gen-maps surface: no current stackTrail, so capture no-ops.
  // withStackTrail is a passthrough so factories don't blow up.
  currentStackTrail: undefined,
  withStackTrail<T>(_stackTrail: unknown, fn: () => T): T {
    return fn()
  }
} as unknown as ParseContextType

/**
 * Build a minimal `ParseContextType` stub wrapping a parsed document.
 * Used by tests that need to construct an `OasRef` (whose constructor
 * derives `document` from `context.parsedDocument`) without spinning
 * up a full ParseContext.
 */
export const toRefParseContextStub = (parsedDocument: SkmtcParsedDocument): ParseContextType =>
  ({
    parsedDocument,
    currentStackTrail: undefined
  }) as unknown as ParseContextType
