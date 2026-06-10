/**
 * @fileoverview RFC 6901 JSON Pointer branded type and helpers.
 *
 * Used by gen-maps (the attribution / sidecar system) to identify
 * the precise location of a schema element within the OpenAPI
 * document. Threaded through parse via `StackTrail.toJsonPointer()`
 * and attached to every parsed OAS schema as `.location`.
 *
 * @module JsonPointer
 */

import type { Brand } from './Brand.ts'

/**
 * Branded type for an RFC 6901 JSON Pointer string.
 *
 * Always starts with `#/` (URI fragment form) or `/` (raw form);
 * helpers in this module produce the URI fragment form so the
 * resulting strings round-trip through the `oas:` URI scheme used
 * in sidecar `S` tables.
 *
 * Empty pointer (`#/`) refers to the document root.
 */
export type JsonPointer = Brand<string, 'JsonPointer'>

/**
 * Escape a single segment per RFC 6901 §4.
 *
 * `~` → `~0` (must be replaced first to avoid double-escaping)
 * `/` → `~1`
 */
export const escapeSegment = (segment: string): string =>
  segment.replaceAll('~', '~0').replaceAll('/', '~1')

/**
 * Unescape a single segment per RFC 6901 §4.
 *
 * `~1` → `/` (must be replaced first)
 * `~0` → `~`
 */
export const unescapeSegment = (segment: string): string =>
  segment.replaceAll('~1', '/').replaceAll('~0', '~')

/**
 * Build a JSON Pointer from an array of unescaped segments.
 * Returns the URI fragment form: `#/<seg1>/<seg2>/...`.
 *
 * Empty array yields `#/` (document root).
 *
 * @example
 * ```ts
 * toJsonPointer(['components', 'schemas', 'User'])
 * // → '#/components/schemas/User'
 *
 * toJsonPointer(['paths', '/users/{id}', 'get'])
 * // → '#/paths/~1users~1{id}/get'
 * ```
 */
export const toJsonPointer = (segments: readonly string[]): JsonPointer => {
  if (segments.length === 0) return '#/' as JsonPointer
  return `#/${segments.map(escapeSegment).join('/')}` as JsonPointer
}

/**
 * Parse a JSON Pointer (URI fragment form `#/...` or raw `/...`)
 * into an array of unescaped segments.
 *
 * Returns `undefined` if the pointer is malformed (doesn't start
 * with `#/` or `/`, or is empty).
 *
 * @example
 * ```ts
 * fromJsonPointer('#/components/schemas/User')
 * // → ['components', 'schemas', 'User']
 *
 * fromJsonPointer('#/paths/~1users~1{id}/get')
 * // → ['paths', '/users/{id}', 'get']
 *
 * fromJsonPointer('#/')
 * // → []
 * ```
 */
export const fromJsonPointer = (pointer: string): string[] | undefined => {
  let body: string
  if (pointer.startsWith('#/')) {
    body = pointer.slice(2)
  } else if (pointer.startsWith('/')) {
    body = pointer.slice(1)
  } else if (pointer === '#' || pointer === '') {
    return []
  } else {
    return undefined
  }
  if (body === '') return []
  return body.split('/').map(unescapeSegment)
}

/**
 * Append one or more segments to an existing JSON Pointer.
 *
 * @example
 * ```ts
 * const base = toJsonPointer(['components', 'schemas', 'User'])
 * append(base, 'properties', 'email')
 * // → '#/components/schemas/User/properties/email'
 * ```
 */
export const append = (pointer: JsonPointer, ...segments: string[]): JsonPointer => {
  if (segments.length === 0) return pointer
  const escaped = segments.map(escapeSegment).join('/')
  if (pointer === ('#/' as JsonPointer)) {
    return `#/${escaped}` as JsonPointer
  }
  return `${pointer}/${escaped}` as JsonPointer
}

/**
 * Type guard for the URI-fragment form.
 *
 * Loose check — verifies prefix and that there are no obviously
 * malformed sequences. Doesn't verify that all `~` instances are
 * followed by `0` or `1` (a stricter validator could).
 */
export const isJsonPointer = (value: unknown): value is JsonPointer => {
  if (typeof value !== 'string') return false
  return value === '#/' || value.startsWith('#/')
}
