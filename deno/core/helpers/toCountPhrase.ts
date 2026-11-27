/**
 * `count` and the noun for it, for a log line: `1 file`, `2 files`.
 *
 * @example
 * ```typescript
 * toCountPhrase(1, 'warning') // '1 warning'
 * toCountPhrase(0, 'error') // '0 errors'
 * toCountPhrase(2, 'debug', 'debug') // '2 debug'
 * ```
 */
export const toCountPhrase = (count: number, singular: string, plural = `${singular}s`): string =>
  `${count} ${count === 1 ? singular : plural}`
