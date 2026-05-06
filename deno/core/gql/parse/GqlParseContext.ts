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
import type { GraphQLSchema } from 'graphql'
import type { GqlRegistry } from '@/gql/registry/GqlRegistry.ts'

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
 */
export type GqlParseContextArgs = {
  /**
   * If false, issues are also written to `console.warn` as they are
   * recorded. Defaults to `true` (collect-only).
   */
  silent?: boolean
}

/**
 * Stateful parse-time context for GraphQL.
 *
 * The OAS pipeline owns its parse state in `ParseContext`. GraphQL is
 * structurally simpler — most validation is delegated to `graphql-js`
 * — so this class is intentionally lighter: just an issues array, a
 * silent flag, and a `log` method.
 *
 * Construction is optional. `toGqlDocument(source)` defaults to a
 * fresh internal context (issues discarded). Callers that want to
 * inspect issues construct a context themselves and pass it through:
 *
 * ```ts
 * const ctx = new GqlParseContext({ silent: false })
 * const doc = toGqlDocument(sdl, {}, ctx)
 * console.log(ctx.issues)
 * ```
 */
export class GqlParseContext {
  readonly issues: GqlParseIssue[] = []
  readonly silent: boolean

  /**
   * Parse-run state. Populated by `toGqlDocument` before any helper
   * function is invoked. Definite-assignment is intentional: helpers
   * are private to the parse lifecycle, so reading these inside a
   * helper is always safe. Reading them before `toGqlDocument` runs
   * is a programming error and will throw the standard
   * "property is undefined" at access time — which is the right
   * signal.
   */
  schema!: GraphQLSchema
  registry!: GqlRegistry

  constructor({ silent = true }: GqlParseContextArgs = {}) {
    this.silent = silent
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
