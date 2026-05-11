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
 * OAS-flavoured input variant for `logIssue` / `logIssueNoKey` — error
 * branch carries the thrown `Error`, warning carries a synthesised
 * `message`. The OAS parser layer constructs these and the unified
 * context translates them into the stored {@link ParseIssue} shape
 * (errors get `cause = error`, both get `protocol: 'oas'`).
 */
export type ParseErrorInput = {
  level: 'error'
  error: Error
}

export type ParseWarningInput = {
  level: 'warning'
  message: string
}

export type ParseIssueInput = ParseErrorInput | ParseWarningInput

/**
 * Arguments accepted by `ParseContext.logIssue` (OAS-flavoured —
 * StackTrail-based location, computed via `stackTrail.trace(key, ...)`).
 */
export type LogIssueArgs = ParseIssueInput & {
  key: string
  stackTrail: StackTrail
  parent: unknown
  type: OasIssueType
}

/**
 * Arguments accepted by `ParseContext.logIssueNoKey` — same as
 * {@link LogIssueArgs} without the `key` field (no inner trace).
 */
export type LogIssueNoKeyArgs = ParseIssueInput & {
  stackTrail: StackTrail
  parent: unknown
  type: OasIssueType
}

/**
 * Arguments accepted by `ParseContext.logSkippedFields` in its
 * OAS-flavoured form (StackTrail-based location).
 */
export type LogSkippedValuesArgs = {
  stackTrail: StackTrail
  skipped: Record<string, unknown>
  parent: unknown
  parentType: string
}

/**
 * Arguments accepted by `ParseContext.logSkippedFields` in its
 * GQL-flavoured form (pre-computed schema-address `location`).
 */
export type LogSkippedFieldsAtArgs = {
  skipped: Record<string, unknown>
  location: string
  parentType: string
  type?: GqlIssueType
}

/**
 * GQL-flavoured input variants for `ParseContext.log` — both error
 * and warning carry a synthesised `message` and a pre-computed
 * `location` string.
 */
export type GqlParseError = {
  level: 'error'
  message: string
  location: string
  type: GqlIssueType
}

export type GqlParseWarning = {
  level: 'warning'
  message: string
  location: string
  type: GqlIssueType
}

export type GqlParseIssueInput = GqlParseError | GqlParseWarning

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
  emitInterfaceUnions?: boolean
}
