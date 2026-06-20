/**
 * The OpenAPI dialects SKMTC parses natively. Each has its own complete
 * parser tree (`core/parse/v3-0`, `core/parse/v3-1`); this module is the
 * ONLY place a document's version is examined. Once a dialect is chosen
 * the matching parser runs top-to-bottom and never re-checks the version,
 * so a 3.0 document can never reach a line of 3.1 logic (or vice versa) —
 * there is no downstream version branch to get wrong.
 */
export type OasDialect = '3.0' | '3.1'

/**
 * Map an OpenAPI document's `openapi` version string to its parser
 * dialect.
 *
 * Detection is EXPLICIT and fails LOUD: an unknown or missing version is a
 * precondition failure — there is no sensible parser to pick — so it throws
 * rather than silently defaulting to one dialect and masking the error. A
 * loose `openapi.startsWith('3.1') ? '3.1' : '3.0'` would route every
 * non-3.1 value (a typo, `3.2`, `4.0`, a missing field) into 3.0 unnoticed;
 * that is the footgun this avoids. Mirrors `@skmtc/convert`'s
 * `toV3Document`, which likewise throws on an unrecognized version.
 *
 * OpenAPI 2.0 (Swagger) never reaches here: `swagger2openapi` upgrades it
 * to 3.0 upstream, host-side, before the document is parsed.
 */
export const toOasDialect = (openapi: string | undefined): OasDialect => {
  if (openapi?.startsWith('3.0')) return '3.0'
  if (openapi?.startsWith('3.1')) return '3.1'

  throw new Error(
    `Unsupported OpenAPI version: ${openapi ?? '(missing)'} — expected 3.0.x or 3.1.x`
  )
}
