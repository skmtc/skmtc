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
 * - ranges such as `*\/*`, `application/*` and `application/*+json`: they do
 *   not name one type.
 * - names without the suffix, such as `application/vnd.goa.error`, even when
 *   the API sends JSON under them.
 */
export const isJsonMediaType = (mediaType: string): boolean => {
  const essence = toMediaTypeEssence(mediaType)
  return essence === 'application/json' || /^application\/[^/*\s]+\+json$/.test(essence)
}

/** True when the media type is the full range `*\/*`, parameters and case ignored. */
export const isAnyMediaType = (mediaType: string): boolean =>
  toMediaTypeEssence(mediaType) === '*/*'

/**
 * True when a schema under `*\/*` can be read as one JSON value: an object,
 * array, union or `$ref`. A scalar is not: under `*\/*` a `string` is usually
 * a text body, and `string` with `format: binary` a file.
 */
const isJsonShaped = (schema: OasSchema | OasRef<'schema'> | undefined): boolean =>
  schema !== undefined &&
  (schema.isRef() || schema.type === 'object' || schema.type === 'array' || schema.type === 'union')

/** The media type a body is read from, and its schema. */
export type JsonContent = {
  /** The key in `content`: a JSON-like media type, or `*\/*` (with any parameters). */
  mediaType: string
  /**
   * The media type to send or expect the body as: `mediaType` when it is
   * JSON-like, `application/json` when the body is read from `*\/*`.
   */
  contentType: string
  schema: OasSchema | OasRef<'schema'> | undefined
}

/**
 * Choose the media type a body is read from: `application/json` exactly when
 * it is a key, else the first JSON-like key in document order (see
 * {@link isJsonMediaType}), else the `*\/*` key when its schema is an object,
 * array, union or `$ref`. `*\/*` admits JSON, and documents use it for JSON
 * bodies (springdoc writes it for every response); the parser logs
 * `WILDCARD_MEDIA_TYPE` for every body read this way. `undefined` otherwise:
 * there is no fall back to a specific non-JSON type, to a narrower range such
 * as `application/*`, or to a scalar schema under `*\/*`, since a consumer
 * would read that body as JSON.
 */
export const toJsonContent = (
  content: Record<string, OasMediaType> | undefined
): JsonContent | undefined => {
  if (!content) {
    return undefined
  }

  const mediaTypes = Object.keys(content)
  const jsonMediaType =
    'application/json' in content ? 'application/json' : mediaTypes.find(isJsonMediaType)

  if (jsonMediaType !== undefined) {
    return {
      mediaType: jsonMediaType,
      contentType: jsonMediaType,
      schema: content[jsonMediaType]?.schema
    }
  }

  const anyMediaType = mediaTypes.find(isAnyMediaType)
  const schema = anyMediaType === undefined ? undefined : content[anyMediaType]?.schema

  return anyMediaType !== undefined && isJsonShaped(schema)
    ? { mediaType: anyMediaType, contentType: 'application/json', schema }
    : undefined
}
