import type { ParseContextType } from '@/context/parseTypes.ts'
import type { StackTrail } from '@/context/StackTrail.ts'
import type { OasMediaType } from '@/oas/mediaType/MediaType.ts'
import { isAnyMediaType, toJsonContent, toMediaTypeEssence } from '@/oas/mediaType/jsonMediaType.ts'

export type LogBodyMediaTypesArgs = {
  /** The parsed `content` map of a response or request body. */
  content: Record<string, OasMediaType> | undefined
  /** Trail of the response or request body; the issue is logged at its `content` key. */
  stackTrail: StackTrail
  context: ParseContextType
}

/**
 * Log at most one issue for a parsed response or request body, from the same
 * choice the lookups make (`toJsonContent`), so the issue and the lookup
 * cannot disagree. Called after the body is built, so a body that fails to
 * parse logs nothing.
 *
 * - `WILDCARD_MEDIA_TYPE` (`warning`): the body is read from `*\/*` as JSON,
 *   though the document does not say its format.
 * - `NO_JSON_MEDIA_TYPE` (`debug`): no lookup reads the body, and its keys
 *   include a range (`*\/*` with a scalar schema, `application/*`), so its
 *   format is unknown.
 *
 * A body with only specific non-JSON types (`multipart/form-data`,
 * `application/octet-stream`, `text/plain`) logs nothing: that is a normal
 * text, form or binary body.
 */
export const logBodyMediaTypes = ({
  content,
  stackTrail,
  context
}: LogBodyMediaTypesArgs): void => {
  const mediaTypes = Object.keys(content ?? {})

  if (mediaTypes.length === 0) {
    return
  }

  const listed = mediaTypes.map(mediaType => `"${mediaType}"`).join(', ')
  // `parent` is only the keys: the issue log serializes it on every issue.
  const parent = { mediaTypes }
  const chosen = toJsonContent(content)

  if (chosen !== undefined) {
    if (isAnyMediaType(chosen.mediaType)) {
      context.logIssue({
        key: 'content',
        level: 'warning',
        type: 'WILDCARD_MEDIA_TYPE',
        message: `Content has no JSON media type (${listed}), so the body is read from "*/*" as JSON although the document does not say its format`,
        parent,
        stackTrail
      })
    }
    return
  }

  if (mediaTypes.some(mediaType => toMediaTypeEssence(mediaType).includes('*'))) {
    context.logIssue({
      key: 'content',
      level: 'debug',
      type: 'NO_JSON_MEDIA_TYPE',
      message: `Content names only a media type range or non-JSON types (${listed}), so no lookup without a media type reads its schema`,
      parent,
      stackTrail
    })
  }
}
