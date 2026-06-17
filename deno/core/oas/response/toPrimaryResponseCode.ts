import type { OasResponse } from './Response.ts'
import type { OasRef } from '../ref/Ref.ts'

/**
 * The status code of the primary success/ack response in a `responses` map.
 *
 * OpenAPI response keys may be a specific code (`200`), a range (`2XX`, `4XX`,
 * …), or `default`. The primary 2xx is resolved in that order of specificity:
 *   1. the lowest specific `2xx` numeric code,
 *   2. otherwise a `2XX` range key (case-insensitive),
 *   3. otherwise `default`,
 *   4. otherwise `undefined`.
 *
 * `parseInt('2XX')` is `2` (< 200), so the numeric scan never mis-claims a
 * range key — the range step handles it explicitly. Shared by
 * `OasOperation.toSuccessResponseCode` and `OasWebhook.toAckResponseCode` so
 * the two cannot drift.
 */
export const toPrimaryResponseCode = (
  responses: Record<string, OasResponse | OasRef<'response'>>
): string | undefined => {
  const keys = Object.keys(responses)

  const [lowest2xx] = keys
    .map(code => parseInt(code))
    .filter(code => code >= 200 && code < 300)
    .sort((a, b) => a - b)
  if (lowest2xx !== undefined) {
    return lowest2xx.toString()
  }

  const range2xx = keys.find(code => /^2XX$/i.test(code))
  if (range2xx !== undefined) {
    return range2xx
  }

  if (responses.default) {
    return 'default'
  }

  return undefined
}
