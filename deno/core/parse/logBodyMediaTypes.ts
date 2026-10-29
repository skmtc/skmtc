import type { ParseContextType } from '@/context/parseTypes.ts'
import type { StackTrail } from '@/context/StackTrail.ts'
import { isAnyMediaType, isJsonMediaType } from '@/oas/mediaType/jsonMediaType.ts'

export type LogBodyMediaTypesArgs = {
  /** The raw `content` map of a response or request body. */
  content: Record<string, unknown> | undefined
  /** Trail of the response or request body; the issue is logged at its `content` key. */
  stackTrail: StackTrail
  context: ParseContextType
  /** The response or request body, for log context. */
  parent: unknown
}

/**
 * Log one issue for a response or request body whose non-empty `content` has
 * no JSON media type. Shared by every parser version: the rule reads only
 * media type keys, and matches the choice of `toJsonContent`.
 *
 * `WILDCARD_MEDIA_TYPE` (`warning`) when a key is `*\/*`: the lookups read the
 * schema under it as JSON, though the document does not say the format.
 * `NO_JSON_MEDIA_TYPE` (`debug`) otherwise: specific non-JSON types or a
 * narrower range such as `application/*`, which the lookups do not read.
 */
export const logBodyMediaTypes = ({
  content,
  stackTrail,
  context,
  parent
}: LogBodyMediaTypesArgs): void => {
  const mediaTypes = Object.keys(content ?? {})

  if (mediaTypes.length === 0 || mediaTypes.some(isJsonMediaType)) {
    return
  }

  const listed = mediaTypes.map(mediaType => `"${mediaType}"`).join(', ')

  if (mediaTypes.some(isAnyMediaType)) {
    context.logIssue({
      key: 'content',
      level: 'warning',
      type: 'WILDCARD_MEDIA_TYPE',
      message: `Content has no JSON media type (${listed}), so the body is read from "*/*" as JSON although the document does not say its format`,
      parent,
      stackTrail
    })
    return
  }

  context.logIssue({
    key: 'content',
    level: 'debug',
    type: 'NO_JSON_MEDIA_TYPE',
    message: `Content has no JSON media type (${listed}), so a JSON lookup reads no schema`,
    parent,
    stackTrail
  })
}
