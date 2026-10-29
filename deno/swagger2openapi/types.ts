/**
 * Shared option and result types for the converter and validator.
 *
 * @module
 */

import type { JsonObject, JsonValue } from './json.ts'

/** A resolved external reference recorded during `$ref` resolution. */
export interface External {
  context: string
  $ref: string
  original: JsonValue
  updated: JsonValue
  source: string
}

/**
 * Handler that resolves an external document for a given protocol, returning
 * its parsed contents. Keyed by protocol (e.g. `http:`, `file:`).
 */
export type ExternalHandler = (
  base: string,
  pointer: string,
  fragment: string,
  options: ResolveOptions
) => Promise<JsonValue>

/** Options governing external `$ref` resolution, shared by converter and validator. */
export interface ResolveOptions {
  /** The location of the document being resolved, used as the base for relative refs. */
  source?: string
  /** Cache of already-fetched external documents, keyed by resolved target. */
  cache?: Record<string, JsonValue>
  /** Log fetched/cached targets to the console. */
  verbose?: boolean
  /** Text encoding used when reading local files. */
  encoding?: string
  /** Per-protocol override handlers. */
  handlers?: Record<string, ExternalHandler>
}

/** Options for {@link import('./converter.ts').convertObj} and friends. */
export interface ConvertOptions extends ResolveOptions {
  /** Fix up small, recoverable errors in the source definition instead of throwing. */
  patch?: boolean
  /** Record non-patchable problems as warning extensions rather than throwing. */
  warnOnly?: boolean
  /** Property name used for warning extensions (default `x-s2o-warning`). */
  warnProperty?: string
  /** Resolve external references before converting. */
  resolve?: boolean
  /** Original document URL; records an `x-origin` provenance entry when set. */
  origin?: string
  /** Emit `x-s2o-*` specification extensions describing the conversion. */
  debug?: boolean
  /** Use WHATWG URL parsing for URL validation where available. */
  whatwg?: boolean
}

/** The outcome of a conversion. */
export interface ConvertResult {
  /** The converted OpenAPI 3.0 document. */
  openapi: JsonObject
  /** External references resolved during conversion (empty unless `resolve` was set). */
  externals: External[]
  /** `true` when the source string was parsed as YAML rather than JSON. */
  sourceYaml: boolean
  /**
   * One entry for each response with a schema whose operation, and the
   * document, list no `produces`. Swagger 2.0 then says nothing about the
   * media type, so the converter chooses one from the schema.
   */
  inferredMediaTypes: InferredMediaType[]
}

/**
 * The media type chosen for a response schema when no `produces` applies.
 * `schemaKind` is what the schema resolved to: an `object` or `array` schema
 * is JSON, a `file` schema is a binary body, and `other` (a scalar, an untyped
 * schema or a `$ref` that does not resolve) gives no answer, so it keeps the
 * `*\/*` range swagger2openapi has always written.
 */
export interface InferredMediaType {
  /** JSON Pointer to the Swagger 2.0 response, e.g. `#/paths/~1pets/get/responses/200`. */
  location: string
  schemaKind: 'object' | 'array' | 'file' | 'other'
  mediaType: 'application/json' | 'application/octet-stream' | '*/*'
}

/** A single linter rule (loaded from `rules.json`). */
export interface LinterRule {
  name: string
  object: string | string[]
  enabled?: boolean
  description: string
  truthy?: string | string[]
  properties?: number
  or?: string[]
  xor?: string[]
  pattern?: { property: string; value: string; split?: string; omit?: string }
  notContain?: { properties: string[]; value: string }
}

/** A linter violation. */
export interface LintViolation {
  rule: string
  description: string
  pointer: string
}

/** Function signature for a linter, allowing a custom implementation to be injected. */
export type Linter = (objectName: string, object: JsonValue, options: ValidateOptions) => void

/** Options for {@link import('./validate.ts').validateSync}. */
export interface ValidateOptions extends ResolveOptions {
  /** Run the linter while validating. */
  lint?: boolean
  /** Custom linter implementation (defaults to the bundled one when `lint` is set). */
  linter?: Linter
  /** Document origin, used as a base URL when validating server URLs. */
  origin?: string
  /** Allow empty server/URL strings. */
  laxurls?: boolean
  /** Use WHATWG URL parsing where available. */
  whatwg?: boolean
  /** Resolve external references before validating. */
  resolve?: boolean
  /** When set, this validation is expected to fail (testing aid). */
  expectFailure?: boolean
  /** Running JSON-Pointer context stack, populated during validation. */
  context?: string[]
  /** Accumulated warnings. */
  warnings?: string[]
  /** Operation ids seen so far (uniqueness check). */
  operationIds?: string[]
  /** Linter violations accumulated when `lint` is set. */
  violations?: LintViolation[]
  /** The rule currently being applied (set by the linter). */
  lintRule?: LinterRule
  /** Path to a replacement JSON Schema (parity-only; unsupported in this port). */
  jsonschema?: string
  /** Result flag set by the validator: `true` when the document is valid. */
  valid?: boolean
}
