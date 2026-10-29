import type { OasRef } from '@/oas/ref/Ref.ts'
import type { OasSchema } from '@/oas/schema/Schema.ts'
import type { OasMediaType } from '@/oas/mediaType/MediaType.ts'

/**
 * The media type without its parameters, trimmed and lowercased:
 * `Application/JSON; charset=utf-8` → `application/json`.
 */
export const toMediaTypeEssence = (mediaType: string): string =>
  (mediaType.split(';')[0] ?? '').trim().toLowerCase()

/**
 * True when a body of this media type is one JSON value: `application/json`,
 * or any `application/…+json` (the RFC 6839 structured syntax suffix, e.g.
 * `application/vnd.api+json`, `application/ld+json`,
 * `application/problem+json`). Parameters and case are ignored, so
 * `application/json;v=1.0` is JSON.
 *
 * False for everything else, including:
 * - `text/json`: not registered; RFC 8259 registers only `application/json`.
 * - `application/x-ndjson`, `application/jsonl`: a stream of JSON values, not
 *   one value.
 * - ranges such as `*\/*` and `application/*`: they do not say the body is JSON.
 * - names without the suffix, such as `application/vnd.goa.error`, even when
 *   the API sends JSON under them.
 */
export const isJsonMediaType = (mediaType: string): boolean => {
  const essence = toMediaTypeEssence(mediaType)
  return essence === 'application/json' || /^application\/[^/*\s]+\+json$/.test(essence)
}

/** True when the media type is a range: `*\/*` or `type/*`. */
export const isMediaTypeRange = (mediaType: string): boolean =>
  toMediaTypeEssence(mediaType).endsWith('/*')

/** The JSON media type chosen from a `content` map, and its schema. */
export type JsonContent = {
  mediaType: string
  schema: OasSchema | OasRef<'schema'> | undefined
}

/**
 * Choose the JSON media type of a `content` map: `application/json` exactly
 * when it is a key, else the first JSON-like key in document order (see
 * {@link isJsonMediaType}). `undefined` when no key is JSON-like; there is no
 * fall back to a non-JSON type, since a consumer would read that body as JSON.
 */
export const toJsonContent = (
  content: Record<string, OasMediaType> | undefined
): JsonContent | undefined => {
  if (!content) {
    return undefined
  }

  const mediaType =
    'application/json' in content ? 'application/json' : Object.keys(content).find(isJsonMediaType)

  return mediaType === undefined ? undefined : { mediaType, schema: content[mediaType]?.schema }
}

/**
 * The schema a `toSchema(mediaType?)` lookup returns: an exact key lookup when
 * `mediaType` is given, else the schema of {@link toJsonContent}.
 */
export const toContentSchema = (
  content: Record<string, OasMediaType> | undefined,
  mediaType: string | undefined
): OasSchema | OasRef<'schema'> | undefined =>
  mediaType === undefined ? toJsonContent(content)?.schema : content?.[mediaType]?.schema
