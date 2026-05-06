/**
 * GraphQL parse-time issue tracking and shared state.
 *
 * Sibling to {@link ParseContext} but scoped to the smaller surface
 * GraphQL parsing actually has. `graphql-js` already validates SDL
 * structurally and throws on syntax / unresolved-name errors, so this
 * context exists to:
 *
 * 1. Carry the parse-run state (`schema`, `registry`) so helper
 *    functions only thread `context` instead of `(schema, registry,
 *    context)` triples — mirrors OAS where helpers take
 *    `(context, stackTrail)` and reach into `context.oasDocument`.
 * 2. Capture *mapping-time* issues — places where the GraphQL → OAS
 *    translation is lossy, hits a defensive fallback, or drops a
 *    GraphQL feature we don't model — that would otherwise be
 *    silently dropped.
 *
 * See `notes/graphql-discrepancies.md` items #1 and #2 for the
 * motivation and design.
 */
import { buildSchema, type GraphQLSchema } from 'graphql'
import { GqlRegistry } from '@/gql/registry/GqlRegistry.ts'
import type { GqlDocument } from '@/gql/document/GqlDocument.ts'
import { parseGqlDocument } from '@/gql/parse/parseGqlDocument.ts'

/**
 * Categories of issues recorded during GraphQL → OAS mapping.
 *
 * Kept narrow on purpose. Extend only when a new lossy/diagnostic
 * code path is added — open-ended categories rot fast.
 *
 * - `NESTED_LIST_LOSSY` — `[[T]]` collapsed to `OasUnknown`.
 * - `UNKNOWN_TYPE_KIND` — defensive fallback for an unrecognised
 *   GraphQL type kind. Should never fire in practice.
 * - `DROPPED_DIRECTIVE` — applied directive ignored during mapping
 *   (other than `@deprecated`, whose `reason` we capture).
 * - `SKIPPED_FIELD_ARGUMENTS` — non-root object/interface field
 *   carries arguments we don't model. Surfaces as a list of arg
 *   names so the user can see what's lost.
 * - `SKIPPED_FEATURE` — catch-all for other GraphQL features that
 *   don't translate (schema-level directive definitions, type
 *   extensions, etc.).
 */
export type GqlIssueType =
  | 'NESTED_LIST_LOSSY'
  | 'UNKNOWN_TYPE_KIND'
  | 'DROPPED_DIRECTIVE'
  | 'SKIPPED_FIELD_ARGUMENTS'
  | 'SKIPPED_FEATURE'

export type GqlParseError = {
  level: 'error'
  message: string
  /** Schema-level address: `Object.field` or `Query.getUser.return`. */
  location: string
  type: GqlIssueType
}

export type GqlParseWarning = {
  level: 'warning'
  message: string
  location: string
  type: GqlIssueType
}

export type GqlParseIssue = GqlParseError | GqlParseWarning

/**
 * Construction args for {@link GqlParseContext}.
 *
 * Mirrors OAS's `ParseContext({ documentObject, logger, silent })` —
 * the parser's input is supplied at construction time so the context
 * has a coherent state for the entirety of its lifetime.
 */
export type GqlParseContextArgs = {
  /**
   * The schema source. SDL string or pre-built `GraphQLSchema`. The
   * constructor calls `buildSchema(source)` for strings; pre-built
   * instances are stored as-is.
   */
  source: string | GraphQLSchema
  /**
   * If false, issues are also written to `console.warn` as they are
   * recorded. Defaults to `true` (collect-only).
   */
  silent?: boolean
}

/**
 * Options accepted by {@link GqlParseContext.parse}.
 *
 * Mirrors the legacy `ToGqlDocumentOptions` shape — exposed here so
 * callers using the OAS-style `ctx.parse(source, options)` entry
 * don't need to import options from the free-function module too.
 */
export type GqlParseOptions = {
  /**
   * Suffix appended to the union form of an interface to disambiguate it
   * from the base interface object type registered under the same logical
   * name. Defaults to `'Union'`.
   */
  interfaceUnionSuffix?: string
  /**
   * Whether to emit the per-interface union of implementers. Default
   * `true`. The base interface object is always emitted.
   */
  emitInterfaceUnions?: boolean
}

/**
 * Stateful parse-time context for GraphQL.
 *
 * Mirrors OAS's `ParseContext` shape:
 * - The input (`source` here, `documentObject` in OAS) is provided
 *   at construction.
 * - The output container (`registry` here, `oasDocument` in OAS) is
 *   created empty in the constructor and populated during `parse()`.
 * - Diagnostic state (`issues`, `silent`) is initialised in the
 *   constructor and read-only thereafter.
 *
 * ```ts
 * const ctx = new GqlParseContext({ source: sdl, silent: false })
 * const doc = ctx.parse({ emitInterfaceUnions: true })
 * console.log(ctx.issues)
 * ```
 *
 * For one-line use without inspecting issues, the convenience
 * function {@link toGqlDocument} wraps construction + `parse()`.
 */
export class GqlParseContext {
  readonly schema: GraphQLSchema
  readonly registry: GqlRegistry
  readonly issues: GqlParseIssue[] = []
  readonly silent: boolean

  constructor({ source, silent = true }: GqlParseContextArgs) {
    this.schema = typeof source === 'string' ? buildSchema(source) : source
    this.registry = new GqlRegistry({ schemas: {} })
    this.silent = silent
  }

  /**
   * Walks the schema and produces a {@link GqlDocument}, recording
   * any lossy / skipped mappings on `this.issues` along the way.
   *
   * Mirrors OAS's `ParseContext.parse(stackTrail)` — the entry point
   * for an explicit parse run. Call once per context; calling twice
   * re-walks the same schema and appends issues again.
   */
  parse(options: GqlParseOptions = {}): GqlDocument {
    return parseGqlDocument({ options, context: this })
  }

  /**
   * Record an issue. Pushes to `issues` and (when `silent: false`)
   * mirrors to `console.warn` so CLI users see something during long
   * runs.
   */
  log(issue: GqlParseIssue): void {
    this.issues.push(issue)

    if (!this.silent) {
      console.warn(`[gql:${issue.level}] ${issue.location}: ${issue.message}`)
    }
  }

  /**
   * Record a `skipped` warning per dropped feature on a node — the
   * GraphQL analog of OAS's `logSkippedFields`. Each key in `skipped`
   * becomes its own warning so consumers can iterate or filter by
   * specific feature names.
   *
   * `type` lets the caller pick a more precise issue category than
   * the default `SKIPPED_FEATURE` — e.g., `SKIPPED_FIELD_ARGUMENTS`
   * for non-root field arguments.
   */
  logSkippedFields({
    skipped,
    location,
    parentType,
    type = 'SKIPPED_FEATURE'
  }: {
    skipped: Record<string, unknown>
    location: string
    parentType: string
    type?: GqlIssueType
  }): void {
    for (const key of Object.keys(skipped)) {
      this.log({
        level: 'warning',
        location,
        message: `Unhandled '${key}' on '${parentType}' — value not represented in generated output`,
        type
      })
    }
  }
}
