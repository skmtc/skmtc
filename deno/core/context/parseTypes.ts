/**
 * Type-only surface for {@link ParseContext}.
 *
 * Parser helpers (under `oas/...` and `parsers/graphql/...`) consume
 * `ParseContextType` as the shape of the context they receive. By
 * importing from this module — rather than from `ParseContext.ts`
 * directly — they avoid pulling the runtime class into their import
 * graph and break the type-level cycle through `toDocumentFieldsV3`.
 *
 * Everything here is `import type`-friendly: zero runtime exports.
 *
 * Mirror-image: the runtime class and the input transforms live in
 * `ParseContext.ts`. Adding a new method to `ParseContext` doesn't
 * require touching this file unless that method is exposed to parser
 * helpers — `ParseContextType` is `ParseContext` (the whole class)
 * aliased here.
 */

import type { ParseContext } from '@/context/ParseContext.ts'
import type { StackTrail } from '@/context/StackTrail.ts'
import type { OasIssueType } from '@/context/generateTypes.ts'
import type { GqlIssueType } from '@/context/ParseIssue.ts'

/**
 * Public interface parsers write their function signatures against.
 * Aliased to the unified `ParseContext` class so type-only consumers
 * compile without depending on the runtime module.
 */
export type ParseContextType = ParseContext

/**
 * Unified input variants for `logIssue` / `logIssueNoKey`. Both
 * variants carry a synthesized `message: string`; the error variant
 * additionally carries an optional `cause: unknown` for the underlying
 * thrown value (preserves stack traces without forcing renderers to
 * know about Error objects). The unified context translates these into
 * the stored {@link ParseIssue} shape, setting `protocol` to whichever
 * protocol the current context is parsing.
 *
 * Replaces an earlier asymmetric design where the error variant
 * carried a raw `Error` instance; that shape didn't survive the worker
 * boundary cleanly (structured clone strips Error prototypes) and
 * forced GQL parsers to use a separate input shape.
 */
export type ParseErrorInput = {
  level: 'error'
  message: string
  cause?: unknown
}

export type ParseWarningInput = {
  level: 'warning'
  message: string
}

export type ParseIssueInput = ParseErrorInput | ParseWarningInput

/**
 * Arguments accepted by `ParseContext.logIssue` (StackTrail-based
 * location, computed via `stackTrail.trace(key, ...)`).
 *
 * `type` accepts either an `OasIssueType` or a `GqlIssueType` — the
 * `protocol` tag on the stored {@link ParseIssue} is set from
 * `ParseContext.protocol.type` at log time, so callers don't have to
 * pass it. Callers are expected to pass a type from the matching
 * protocol's enum.
 *
 * `parent` is the surrounding object (e.g. the whole schema /
 * AST node) that contains the field at `key`. It is **not** stored on
 * the persisted `ParseIssue` — it's logged through the standard logger
 * so log readers see the broader context, not just the leaf address.
 */
export type LogIssueArgs = ParseIssueInput & {
  key: string
  stackTrail: StackTrail
  parent: unknown
  type: OasIssueType | GqlIssueType
}

/**
 * Arguments accepted by `ParseContext.logIssueNoKey` — same as
 * {@link LogIssueArgs} without the `key` field (no inner trace).
 */
export type LogIssueNoKeyArgs = ParseIssueInput & {
  stackTrail: StackTrail
  parent: unknown
  type: OasIssueType | GqlIssueType
}

/**
 * Arguments accepted by `ParseContext.logSkippedFields`. The same
 * shape works for both protocols — callers thread a `stackTrail`
 * representing the parent (e.g. `[components, schemas, User]` for OAS
 * or `[User]` for GQL); each skipped key is traced as a child.
 *
 * `parent` follows the same role as on {@link LogIssueArgs}: passed
 * through to the logger so log readers see the surrounding object that
 * carried the unrecognized fields.
 */
export type LogSkippedValuesArgs = {
  stackTrail: StackTrail
  skipped: Record<string, unknown>
  parent: unknown
  parentType: string
  /**
   * Issue type to record. Defaults to `UNEXPECTED_PROPERTY` (OAS) at
   * the call site convention, but GQL callers can pass a more
   * specific category (e.g. `SKIPPED_FIELD_ARGUMENTS`).
   */
  type?: OasIssueType | GqlIssueType
}

/**
 * Arguments accepted by `ParseContext.log` — the thin convenience for
 * recording an issue at a pre-computed `location` string rather than
 * threading a {@link StackTrail}.
 *
 * Use this for issues whose natural address isn't a tree position:
 *
 *   - Schema-level directive definitions (`@auth`, `@cost`) — flat
 *     namespace, no parent type.
 *   - Catch-all error paths where the parsed entity doesn't exist
 *     yet (the parse threw before producing one).
 *
 * For tree-position issues (a field of a type, a parameter of an
 * operation), prefer `logIssueNoKey` so the stack trail composes
 * naturally with the surrounding traces.
 *
 * `location` is split on `:` to reconstruct a `StackTrail` for the
 * underlying call, matching the protocol-neutral separator used
 * elsewhere.
 */
export type LogAtArgs = ParseIssueInput & {
  location: string
  /**
   * Surrounding object for log context (optional — synthetic-location
   * issues often have none). Forwarded to the logger; not stored on
   * the persisted issue.
   */
  parent?: unknown
  type: OasIssueType | GqlIssueType
}

/**
 * Internal "post-protocol" issue input — what `ParseContext.logIssueAt`
 * accepts. Both protocols funnel here after their surface-specific
 * adapters compute the location and inject the `protocol` tag.
 */
export type LogIssueAtArgs =
  | {
      protocol: 'oas'
      level: 'error'
      type: OasIssueType
      location: string
      message: string
      cause?: unknown
    }
  | {
      protocol: 'oas'
      level: 'warning'
      type: OasIssueType
      location: string
      message: string
    }
  | {
      protocol: 'gql'
      level: 'error'
      type: GqlIssueType
      location: string
      message: string
      cause?: unknown
    }
  | {
      protocol: 'gql'
      level: 'warning'
      type: GqlIssueType
      location: string
      message: string
    }

/**
 * Options accepted by the GQL parse phase. Passed through the
 * `ParseContext` constructor's `options.gql` slot.
 */
export type GqlParseOptions = {
  interfaceUnionSuffix?: string
  synthesizeInterfaceUnions?: boolean
}
