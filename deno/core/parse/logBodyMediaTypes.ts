import type { ParseContextType } from '@/context/parseTypes.ts'
import type { StackTrail } from '@/context/StackTrail.ts'
import { isJsonMediaType, isMediaTypeRange } from '@/oas/mediaType/jsonMediaType.ts'

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
 * no JSON media type, so a JSON lookup (`OasResponse.toSchema()`) finds no
 * schema. Shared by every parser version: the rule reads only media type keys.
 *
 * `WILDCARD_MEDIA_TYPE` (`warning`) when every key is a range such as `*\/*`;
 * `NO_JSON_MEDIA_TYPE` (`debug`) when the keys name specific non-JSON types.
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

  if (mediaTypes.every(isMediaTypeRange)) {
    context.logIssue({
      key: 'content',
      level: 'warning',
      type: 'WILDCARD_MEDIA_TYPE',
      message: `Content lists only the media type range ${listed}, so the body format is unknown and a JSON lookup reads no schema`,
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
